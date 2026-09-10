import { getSupabaseAdmin } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { syncStripeSubscription } from "../_lib/stripeSubscriptions.js";

/**
 * Stripe webhook — only trusted path to mark payments/invoices paid or refunded.
 *
 * This generic TitanOS handler intentionally remains separate from Titan Attention.
 * Attention funding is handled by the Cloudflare edge payment runtime so the
 * general invoice/payment/subscription lifecycle is never overwritten again.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

const CHECKOUT_SUCCESS_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);
const STRIPE_API_TIMEOUT_MS = 10_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function checkoutPaymentIsSettled(eventType, session) {
  return CHECKOUT_SUCCESS_EVENTS.has(eventType) && session?.payment_status === "paid";
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function validUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Stripe Charge.amount_refunded is cumulative. The returned amount never moves
 * backward, which makes refund processing safe when Stripe events arrive out of
 * order. Invoice-principal allocation is only returned when it is exact:
 * zero-fee payments or a full refund.
 */
export function deriveRefundReconciliation({
  chargeAmountCents,
  amountRefundedCents,
  previousRefundedAmount = 0,
  baseAmount,
  platformFee = 0,
}) {
  const chargeAmount = money(Number(chargeAmountCents) / 100);
  const reportedRefunded = money(Number(amountRefundedCents) / 100);
  const previousRefunded = money(Number(previousRefundedAmount) || 0);
  const base = money(baseAmount == null ? chargeAmount : Number(baseAmount));
  const fee = money(Number(platformFee) || 0);

  if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
    throw new Error("Invalid Stripe charge amount");
  }
  if (!Number.isFinite(reportedRefunded) || reportedRefunded < 0 || reportedRefunded > chargeAmount + 0.01) {
    throw new Error("Invalid Stripe refunded amount");
  }
  if (!Number.isFinite(previousRefunded) || previousRefunded < 0 || previousRefunded > chargeAmount + 0.01) {
    throw new Error("Invalid stored refunded amount");
  }
  if (!Number.isFinite(base) || base < 0 || base > chargeAmount + 0.01) {
    throw new Error("Invalid payment base amount");
  }
  if (!Number.isFinite(fee) || fee < 0 || fee > chargeAmount + 0.01) {
    throw new Error("Invalid payment platform fee");
  }

  const cumulativeRefunded = money(Math.max(previousRefunded, Math.min(chargeAmount, reportedRefunded)));
  const refundDelta = money(Math.max(0, cumulativeRefunded - previousRefunded));
  const fullRefund = cumulativeRefunded + 0.01 >= chargeAmount;
  const zeroFeePayment = fee <= 0.01 && Math.abs(base - chargeAmount) <= 0.01;
  const refundedBaseAmount = fullRefund
    ? base
    : zeroFeePayment
      ? money(Math.min(base, cumulativeRefunded))
      : null;

  return {
    chargeAmount,
    cumulativeRefunded,
    refundDelta,
    fullRefund,
    refundedBaseAmount,
    requiresPrincipalAllocation:
      cumulativeRefunded > 0 && !fullRefund && refundedBaseAmount == null,
  };
}

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

function shouldPreservePaymentStatus(existingStatus, nextStatus) {
  if (existingStatus === "refunded" && nextStatus !== "refunded") return true;
  if (
    existingStatus === "succeeded" &&
    ["failed", "canceled", "cancelled"].includes(nextStatus)
  ) {
    return true;
  }
  return false;
}

async function markPaymentStatus(admin, { paymentId, sessionId, status, extraNote }) {
  const now = new Date().toISOString();
  if (paymentId) {
    const { data: existing, error: findError } = await admin
      .from("payments")
      .select("id, status, note")
      .eq("id", paymentId)
      .maybeSingle();
    if (findError) throw findError;
    if (shouldPreservePaymentStatus(existing?.status, status)) return existing;
    if (existing?.status === status) return existing;
    const patch = { status, updated_at: now };
    if (extraNote) patch.note = `${existing?.note || ""} · ${extraNote}`.trim();
    const { error: updateError } = await admin.from("payments").update(patch).eq("id", paymentId);
    if (updateError) throw updateError;
    return { id: paymentId, status };
  }
  if (sessionId) {
    const { data: byExt, error: findError } = await admin
      .from("payments")
      .select("id, status, note")
      .eq("external_id", sessionId)
      .maybeSingle();
    if (findError) throw findError;
    if (!byExt) return null;
    if (shouldPreservePaymentStatus(byExt.status, status)) return byExt;
    if (byExt.status === status) return byExt;
    const patch = { status, updated_at: now };
    if (extraNote) patch.note = `${byExt.note || ""} · ${extraNote}`.trim();
    const { error: updateError } = await admin.from("payments").update(patch).eq("id", byExt.id);
    if (updateError) throw updateError;
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
  const { data: inv, error: findError } = await admin
    .from("invoices")
    .select("id, status, balance_due, total, amount_paid, created_by_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (findError) throw findError;
  if (!inv || inv.status === "paid") return;
  if (expectedUserId && inv.created_by_id && String(inv.created_by_id) !== String(expectedUserId)) {
    logError("stripeWebhook:invoice_owner_mismatch", {
      invoiceId,
      expectedUserId,
      owner: inv.created_by_id,
    });
    return;
  }
  const due = Number(inv.balance_due ?? inv.total ?? 0);
  const basePaid =
    expectedBaseAmount != null && Number.isFinite(Number(expectedBaseAmount))
      ? Number(expectedBaseAmount)
      : Number(amountTotal) -
        (expectedPlatformFee != null && Number.isFinite(Number(expectedPlatformFee))
          ? Number(expectedPlatformFee)
          : 0);
  if (!Number.isFinite(basePaid) || basePaid <= 0) {
    logError("stripeWebhook:invalid_settlement_amount", { invoiceId, amountTotal, basePaid });
    return;
  }
  if (due > 0 && basePaid + 0.01 < due) {
    logError("stripeWebhook:underpayment", { invoiceId, amountTotal, basePaid, due });
    return;
  }

  const previousPaid = Number(inv.amount_paid || 0);
  const invoiceTotal = Number(inv.total || previousPaid + basePaid);
  const authoritativePaid = Math.min(invoiceTotal, previousPaid + basePaid);
  let update = admin
    .from("invoices")
    .update({
      status: "paid",
      balance_due: 0,
      amount_paid: authoritativePaid,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (expectedUserId) update = update.eq("created_by_id", expectedUserId);
  const { error: updateError } = await update;
  if (updateError) throw updateError;
}

async function resolveRefundContext(stripe, charge) {
  const chargeMetadata = charge?.metadata || {};
  let checkoutSession = null;
  const paymentIntentId =
    typeof charge?.payment_intent === "string"
      ? charge.payment_intent
      : charge?.payment_intent?.id || null;

  if (
    paymentIntentId &&
    (!chargeMetadata.payment_id || !chargeMetadata.invoice_id || !chargeMetadata.source)
  ) {
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      checkoutSession = sessions?.data?.[0] || null;
    } catch (error) {
      logError("stripeWebhook:refund_checkout_lookup", {
        message: error?.message || String(error),
        chargeId: charge?.id || null,
      });
    }
  }

  const metadata = {
    ...(checkoutSession?.metadata || {}),
    ...chargeMetadata,
  };

  return {
    metadata,
    checkoutSession,
    invoiceId: metadata.invoice_id || checkoutSession?.client_reference_id || null,
    paymentId: metadata.payment_id || null,
    expectedUserId: metadata.invoice_owner_id || metadata.user_id || null,
  };
}

async function findRefundPayment(admin, { paymentId, checkoutSession }) {
  if (paymentId && validUuid(paymentId)) {
    const { data, error } = await admin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (checkoutSession?.id) {
    const { data, error } = await admin
      .from("payments")
      .select("*")
      .eq("external_id", checkoutSession.id)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function reconcileStripeRefund(admin, stripe, charge) {
  const context = await resolveRefundContext(stripe, charge);
  const payment = await findRefundPayment(admin, context);

  if (!payment) {
    logError("stripeWebhook:unmatched_refund", {
      chargeId: charge?.id || null,
      paymentIntentId:
        typeof charge?.payment_intent === "string"
          ? charge.payment_intent
          : charge?.payment_intent?.id || null,
      checkoutId: context.checkoutSession?.id || null,
      invoiceId: context.invoiceId || null,
      source: context.metadata?.source || null,
    });
    return { matched: false, reason: "payment_not_found" };
  }

  if (context.paymentId && validUuid(context.paymentId) && String(payment.id) !== String(context.paymentId)) {
    throw new Error("Stripe refund payment linkage mismatch");
  }
  if (context.invoiceId && payment.invoice_id && String(payment.invoice_id) !== String(context.invoiceId)) {
    throw new Error("Stripe refund invoice linkage mismatch");
  }

  let expectedOwner = null;
  if (context.expectedUserId) {
    if (!validUuid(context.expectedUserId)) throw new Error("Invalid Stripe refund owner metadata");
    expectedOwner = context.expectedUserId;
    if (
      payment.created_by_id &&
      String(payment.created_by_id) !== String(expectedOwner) &&
      payment.user_id &&
      String(payment.user_id) !== String(expectedOwner)
    ) {
      throw new Error("Stripe refund owner mismatch");
    }
  }

  const invoiceId = context.invoiceId || payment.invoice_id || null;
  if (invoiceId && !validUuid(String(invoiceId))) {
    throw new Error("Invalid Stripe refund invoice metadata");
  }

  const paymentTotal = Number(payment.amount_total ?? payment.amount ?? 0);
  const paymentBase = Number(payment.base_amount ?? payment.amount ?? 0);
  const platformFee = Number(
    payment.platform_fee ?? Math.max(0, paymentTotal - paymentBase)
  );
  const reconciliation = deriveRefundReconciliation({
    chargeAmountCents: charge?.amount,
    amountRefundedCents: charge?.amount_refunded,
    previousRefundedAmount: payment.refunded_amount || 0,
    baseAmount: paymentBase,
    platformFee,
  });

  if (!Number.isFinite(paymentTotal) || Math.abs(paymentTotal - reconciliation.chargeAmount) > 0.01) {
    throw new Error("Stripe refund charge amount does not match TitanOS payment");
  }
  if (
    charge?.currency &&
    payment.currency &&
    String(charge.currency).toLowerCase() !== String(payment.currency).toLowerCase()
  ) {
    throw new Error("Stripe refund currency does not match TitanOS payment");
  }

  const { data, error: rpcError } = await admin.rpc("reconcile_stripe_refund", {
    p_payment_id: payment.id,
    p_invoice_id: invoiceId || null,
    p_expected_owner: expectedOwner,
    p_currency: charge?.currency || payment.currency || null,
    p_charge_amount: reconciliation.chargeAmount,
    p_refunded_amount: reconciliation.cumulativeRefunded,
    p_refunded_base_amount: reconciliation.refundedBaseAmount,
  });
  if (rpcError) {
    logError("stripeWebhook:refund_reconciliation_rpc", {
      message: rpcError.message,
      paymentId: payment.id,
      invoiceId: invoiceId || null,
    });
    throw rpcError;
  }

  if (reconciliation.requiresPrincipalAllocation && invoiceId) {
    // Stripe partial refunds do not identify which Checkout line item was
    // refunded. If the original charge contained a TitanOS fee, changing the
    // invoice principal would invent accounting policy. Keep the payment refund
    // ledger authoritative and surface this case for manual allocation.
    logError("stripeWebhook:partial_refund_allocation_required", {
      paymentId: payment.id,
      invoiceId,
      refundedAmount: reconciliation.cumulativeRefunded,
      platformFee,
    });
  }

  return {
    matched: true,
    paymentId: payment.id,
    invoiceId,
    ...reconciliation,
    rpc: data || null,
  };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
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
      return res.status(400).json({ error: "Raw body required for Stripe signature verification." });
    }

    let event;
    let stripe;
    try {
      const Stripe = (await import("stripe")).default;
      stripe = new Stripe(stripeKey, {
        timeout: STRIPE_API_TIMEOUT_MS,
        maxNetworkRetries: 1,
      });
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (sigErr) {
      logError("stripeWebhook:signature", sigErr);
      captureApiException(sigErr, { tags: { route: "stripeWebhook", stage: "signature" } });
      return res.status(400).json({ error: "Invalid signature" });
    }

    const admin = getSupabaseAdmin();
    let idempotencyClaimed = false;

    if (event.id) {
      try {
        const object = event.data?.object || {};
        const { error: idemErr } = await admin.from("stripe_webhook_events").insert({
          event_id: event.id,
          event_type: event.type,
          payment_id: object.metadata?.payment_id || null,
          payload_summary: {
            type: event.type,
            object_id: object.id || null,
            amount_refunded:
              event.type === "charge.refunded" && Number.isFinite(Number(object.amount_refunded))
                ? Number(object.amount_refunded)
                : undefined,
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
      const invoiceId = session.metadata?.invoice_id || session.client_reference_id || null;
      const paymentId = session.metadata?.payment_id || null;
      const expectedUserId = session.metadata?.invoice_owner_id || session.metadata?.user_id || null;
      const sessionId = session.id || null;
      const amountTotal = (session.amount_total || 0) / 100;
      const expectedBaseAmount =
        session.metadata?.base_amount != null ? Number(session.metadata.base_amount) : null;
      const expectedPlatformFee =
        session.metadata?.platform_fee != null ? Number(session.metadata.platform_fee) : null;

      if (CHECKOUT_SUCCESS_EVENTS.has(event.type) && session.mode === "subscription") {
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price"],
          });
          await syncStripeSubscription(admin, subscription);
        }
      } else if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        await syncStripeSubscription(admin, session);
      } else if (CHECKOUT_SUCCESS_EVENTS.has(event.type)) {
        if (!checkoutPaymentIsSettled(event.type, session)) {
          return res.status(200).json({
            received: true,
            type: event.type,
            ignored: "payment_not_settled",
          });
        }

        let payRow = null;
        if (paymentId) {
          const { data, error: paymentLookupError } = await admin
            .from("payments")
            .select("*")
            .eq("id", paymentId)
            .maybeSingle();
          if (paymentLookupError) throw paymentLookupError;
          payRow = data;
          if (
            payRow &&
            expectedUserId &&
            String(payRow.user_id) !== String(expectedUserId) &&
            String(payRow.created_by_id) !== String(expectedUserId)
          ) {
            logError("stripeWebhook:payment_user_mismatch", { paymentId, expectedUserId });
            return res.status(200).json({ received: true, type: event.type, ignored: "ownership" });
          }
          if (payRow?.invoice_id && invoiceId && String(payRow.invoice_id) !== String(invoiceId)) {
            logError("stripeWebhook:payment_invoice_mismatch", {
              paymentId,
              invoiceId,
              paymentInvoiceId: payRow.invoice_id,
            });
            return res.status(200).json({ received: true, type: event.type, ignored: "invoice_linkage" });
          }
        }

        const priorRefundedAmount = Number(payRow?.refunded_amount || 0);
        const hasPriorRefund =
          payRow?.status === "refunded" ||
          (Number.isFinite(priorRefundedAmount) && priorRefundedAmount > 0.01);

        if (hasPriorRefund) {
          // A refund event may arrive before Checkout success. Its atomic
          // reconciliation already established the invoice's net payment state;
          // never let a later success event erase that refund.
          logError("stripeWebhook:settlement_after_refund", {
            paymentId: payRow?.id || paymentId || null,
            invoiceId: invoiceId || payRow?.invoice_id || null,
            refundedAmount: priorRefundedAmount,
          });
        } else {
          await markInvoicePaid(admin, invoiceId, amountTotal, expectedUserId, {
            expectedBaseAmount,
            expectedPlatformFee,
          });
        }
        await markPaymentStatus(admin, { paymentId, sessionId, status: "succeeded" });
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
      } else if (event.type === "payment_intent.payment_failed" || event.type === "charge.failed") {
        const piMeta = session.metadata || {};
        await markPaymentStatus(admin, {
          paymentId: piMeta.payment_id || paymentId,
          sessionId: null,
          status: "failed",
          extraNote: `Stripe ${event.type}: ${session.last_payment_error?.message || "failed"}`,
        });
      } else if (event.type === "charge.refunded") {
        const refundResult = await reconcileStripeRefund(admin, stripe, session);
        if (!refundResult.matched && event.id) {
          await admin
            .from("stripe_webhook_events")
            .update({
              payload_summary: {
                type: event.type,
                object_id: session.id || null,
                amount_refunded: session.amount_refunded || 0,
                reconciliation: "unmatched_refund",
              },
            })
            .eq("event_id", event.id);
        }
      }

      return res.status(200).json({ received: true, type: event.type });
    } catch (processErr) {
      if (idempotencyClaimed && event.id) {
        try {
          await admin.from("stripe_webhook_events").delete().eq("event_id", event.id);
        } catch {
          /* allow Stripe retry */
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
