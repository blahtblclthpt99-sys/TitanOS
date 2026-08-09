import { getSupabaseAdmin } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";

/**
 * Stripe webhook — only trusted path to mark payments/invoices paid.
 *
 * Vercel config: ensure this route receives the raw body for signature verification.
 * Set STRIPE_WEBHOOK_SECRET and point Stripe to /api/functions/stripeWebhook
 *
 * Until raw-body verification works, this handler refuses to mark anything paid.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length) return Buffer.concat(chunks);
  return null;
}

async function markPaymentStatus(admin, { paymentId, sessionId, status, extraNote }) {
  const now = new Date().toISOString();
  if (paymentId) {
    const { data: existing } = await admin
      .from("payments")
      .select("id, status, note")
      .eq("id", paymentId)
      .maybeSingle();
    if (existing?.status === "succeeded" && status !== "succeeded") return existing;
    if (existing?.status === status) return existing;
    const patch = { status, updated_at: now };
    if (extraNote) patch.note = `${existing?.note || ""} · ${extraNote}`.trim();
    await admin.from("payments").update(patch).eq("id", paymentId);
    return { id: paymentId, status };
  }
  if (sessionId) {
    const { data: byExt } = await admin
      .from("payments")
      .select("id, status, note")
      .eq("external_id", sessionId)
      .maybeSingle();
    if (!byExt) return null;
    if (byExt.status === "succeeded" && status !== "succeeded") return byExt;
    if (byExt.status === status) return byExt;
    const patch = { status, updated_at: now };
    if (extraNote) patch.note = `${byExt.note || ""} · ${extraNote}`.trim();
    await admin.from("payments").update(patch).eq("id", byExt.id);
    return { ...byExt, status };
  }
  return null;
}

async function markInvoicePaid(
  admin,
  invoiceId,
  amountTotal,
  expectedUserId,
  { expectedBaseAmount = null, expectedPlatformFee = null } = {}
) {
  if (!invoiceId) return;
  const { data: inv } = await admin
    .from("invoices")
    .select("id, status, balance_due, total, created_by_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv || inv.status === "paid") return;
  if (expectedUserId && inv.created_by_id && inv.created_by_id !== expectedUserId) {
    logError("stripeWebhook:invoice_owner_mismatch", {
      invoiceId,
      expectedUserId,
      owner: inv.created_by_id,
    });
    return;
  }
  const due = Number(inv.balance_due ?? inv.total ?? 0);
  // Compare service base (excluding platform fee) against invoice due.
  // amountTotal from Stripe includes fees; using it alone could mark underpaid invoices paid.
  const basePaid =
    expectedBaseAmount != null && Number.isFinite(Number(expectedBaseAmount))
      ? Number(expectedBaseAmount)
      : Number(amountTotal) -
        (expectedPlatformFee != null && Number.isFinite(Number(expectedPlatformFee))
          ? Number(expectedPlatformFee)
          : 0);
  if (due > 0 && basePaid + 0.01 < due) {
    logError("stripeWebhook:underpayment", { invoiceId, amountTotal, basePaid, due });
    return;
  }
  await admin
    .from("invoices")
    .update({
      status: "paid",
      balance_due: 0,
      amount_paid: amountTotal,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  // High ceiling so Stripe retries are not blocked; still guards extreme abuse.
  if (!assertRateLimit(req, res, { limit: 600, windowMs: 60_000, key: "stripeWebhook" })) return;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return res.status(503).json({ error: "Stripe webhook not configured" });
  }

  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing Stripe-Signature" });

    const rawBody = await readRawBody(req);
    if (!rawBody || !rawBody.length) {
      return res.status(400).json({
        error:
          "Raw body required for Stripe signature verification. Configure bodyParser:false for this route.",
      });
    }

    let event;
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey);
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (sigErr) {
      logError("stripeWebhook:signature", sigErr);
      captureApiException(sigErr, { tags: { route: "stripeWebhook", stage: "signature" } });
      // Never process unverified events — including when STRIPE_WEBHOOK_RELAXED is set.
      return res.status(400).json({ error: "Invalid signature" });
    }

    const admin = getSupabaseAdmin();
    let idempotencyClaimed = false;

    // Idempotency — claim event id; on failure after claim, release so Stripe can retry
    if (event.id) {
      try {
        const { error: idemErr } = await admin.from("stripe_webhook_events").insert({
          event_id: event.id,
          event_type: event.type,
          payment_id: event.data?.object?.metadata?.payment_id || null,
          payload_summary: {
            type: event.type,
            object_id: event.data?.object?.id || null,
          },
        });
        if (idemErr) {
          if (idemErr.code === "23505" || /duplicate|unique/i.test(idemErr.message || "")) {
            return res.status(200).json({ received: true, type: event.type, duplicate: true });
          }
          if (idemErr.code === "42P01" || /does not exist|relation/i.test(idemErr.message || "")) {
            logError("stripeWebhook:idempotency_table_missing", idemErr);
            captureApiException(idemErr, { tags: { route: "stripeWebhook", stage: "idempotency" } });
            return res.status(503).json({
              error: "Webhook idempotency table missing. Apply migration 018_stripe_webhook_idempotency.sql",
            });
          }
          logError("stripeWebhook:idempotency", idemErr);
          captureApiException(idemErr, { tags: { route: "stripeWebhook", stage: "idempotency" } });
          return res.status(500).json({ error: "Webhook idempotency failed" });
        }
        idempotencyClaimed = true;
      } catch (idemCatch) {
        logError("stripeWebhook:idempotency", idemCatch);
        return res.status(500).json({ error: "Webhook idempotency failed" });
      }
    }

    try {
    const session = event.data?.object || {};
    const invoiceId =
      session.metadata?.invoice_id || session.client_reference_id || null;
    const paymentId = session.metadata?.payment_id || null;
    const expectedUserId = session.metadata?.user_id || null;
    const sessionId = session.id || null;
    const amountTotal = (session.amount_total || 0) / 100;
    const expectedBaseAmount =
      session.metadata?.base_amount != null ? Number(session.metadata.base_amount) : null;
    const expectedPlatformFee =
      session.metadata?.platform_fee != null ? Number(session.metadata.platform_fee) : null;

    if (event.type === "checkout.session.completed") {
      if (session.metadata?.task_type === "invoice_recovery_sprint" && session.payment_status !== "paid") {
        return res.status(200).json({ received: true, type: event.type, ignored: "payment_not_settled" });
      }
      // Prefer payment row linkage; verify ownership before marking invoice
      if (paymentId) {
        const { data: payRow } = await admin
          .from("payments")
          .select("id, user_id, created_by_id, invoice_id, amount, amount_total, status")
          .eq("id", paymentId)
          .maybeSingle();
        if (payRow && expectedUserId && payRow.user_id !== expectedUserId && payRow.created_by_id !== expectedUserId) {
          logError("stripeWebhook:payment_user_mismatch", { paymentId, expectedUserId });
          return res.status(200).json({ received: true, type: event.type, ignored: "ownership" });
        }
      }
      await markInvoicePaid(admin, invoiceId, amountTotal, expectedUserId, {
        expectedBaseAmount,
        expectedPlatformFee,
      });
      await markPaymentStatus(admin, {
        paymentId,
        sessionId,
        status: "succeeded",
      });
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await markPaymentStatus(admin, {
        paymentId,
        sessionId,
        status: "canceled",
        extraNote: `Stripe ${event.type}`,
      });
    } else if (
      event.type === "payment_intent.payment_failed" ||
      event.type === "charge.failed"
    ) {
      const piMeta = session.metadata || {};
      await markPaymentStatus(admin, {
        paymentId: piMeta.payment_id || paymentId,
        sessionId: null,
        status: "failed",
        extraNote: `Stripe ${event.type}: ${session.last_payment_error?.message || "failed"}`,
      });
    } else if (event.type === "charge.refunded") {
      const piMeta = session.metadata || {};
      await markPaymentStatus(admin, {
        paymentId: piMeta.payment_id || paymentId,
        sessionId: sessionId || session.payment_intent || null,
        status: "refunded",
        extraNote: `Stripe ${event.type}`,
      });
    }

    return res.status(200).json({ received: true, type: event.type });
    } catch (processErr) {
      if (idempotencyClaimed && event.id) {
        try {
          await admin.from("stripe_webhook_events").delete().eq("event_id", event.id);
        } catch {
          /* allow Stripe retry even if release fails */
        }
      }
      throw processErr;
    }
  } catch (error) {
    logError("stripeWebhook", error);
    captureApiException(error, { tags: { route: "stripeWebhook" } });
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
