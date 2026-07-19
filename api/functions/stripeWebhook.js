import { getSupabaseAdmin } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

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

async function markInvoicePaid(admin, invoiceId, amountTotal) {
  if (!invoiceId) return;
  const { data: inv } = await admin
    .from("invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv || inv.status === "paid") return;
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
      console.error("Stripe signature verify failed:", sigErr.message);
      // Never process unverified events — including when STRIPE_WEBHOOK_RELAXED is set.
      return res.status(400).json({ error: "Invalid signature" });
    }

    const admin = getSupabaseAdmin();
    const session = event.data?.object || {};
    const invoiceId =
      session.metadata?.invoice_id || session.client_reference_id || null;
    const paymentId = session.metadata?.payment_id || null;
    const sessionId = session.id || null;
    const amountTotal = (session.amount_total || 0) / 100;

    if (event.type === "checkout.session.completed") {
      await markInvoicePaid(admin, invoiceId, amountTotal);
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
    }

    return res.status(200).json({ received: true, type: event.type });
  } catch (error) {
    console.error("stripeWebhook error:", error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
