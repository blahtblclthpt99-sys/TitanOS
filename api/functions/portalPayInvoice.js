import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin, allowedOrigins } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { requirePortalSession } from "../_lib/requirePortalSession.js";
import { fetchWithTimeout, isAbortError } from "../_lib/fetchTimeout.js";
import { logError } from "../_lib/safeLog.js";

const STRIPE_CHECKOUT_TIMEOUT_MS = 10_000;

async function requestStripeCheckout(params, headers) {
  const attempts = headers["Idempotency-Key"] ? 2 : 1;
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchWithTimeout(
        "https://api.stripe.com/v1/checkout/sessions",
        {
          method: "POST",
          headers,
          body: params.toString(),
        },
        STRIPE_CHECKOUT_TIMEOUT_MS
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Stripe checkout request failed");
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 15, windowMs: 60_000, key: "portalPayInvoice" })) return;

  try {
    const admin = getSupabaseAdmin();
    const { token, invoice_id: invoiceId } = readJson(req);
    const auth = await requirePortalSession(admin, token);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (!auth.session.created_by_id) return res.status(401).json({ error: "Invalid or expired session" });
    if (!invoiceId) return res.status(400).json({ error: "invoice_id is required" });

    const { data: invoice, error: findErr } = await admin
      .from("invoices")
      .select("id,invoice_number,customer_id,customer_name,created_by_id,status,total,balance_due")
      .eq("id", invoiceId)
      .eq("customer_id", auth.session.customer_id)
      .eq("created_by_id", auth.session.created_by_id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (["paid", "void", "cancelled", "refunded"].includes(String(invoice.status || "").toLowerCase())) {
      return res.status(409).json({ error: "Invoice is not payable" });
    }

    const amount = Number(invoice.balance_due || invoice.total || 0);
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const configuredOrigin = String(process.env.APP_ORIGIN || "").replace(/\/$/, "");
    const origin =
      (configuredOrigin && allowedOrigins().includes(configuredOrigin) && configuredOrigin) ||
      resolveAppOrigin(req);

    if (!stripeKey) {
      return res.status(503).json({
        error: "Payments are not configured yet. Ask your provider to enable Stripe Checkout.",
        setupRequired: true,
      });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return res.status(400).json({ error: "Invoice has no valid balance due" });
    }

    // Customer-portal invoice payments do not add a TitanOS platform surcharge.
    // Persist the payment before creating Checkout so every later Stripe event
    // has an internal reconciliation identity.
    const ownerId = String(auth.session.created_by_id);
    const paymentNote = "Customer portal invoice payment (no TitanOS platform fee).";
    const insertPayload = {
      user_id: ownerId,
      created_by_id: ownerId,
      invoice_id: invoiceId,
      customer_name: invoice.customer_name || "",
      amount,
      base_amount: amount,
      platform_fee: 0,
      platform_fee_rate: 0,
      amount_total: amount,
      currency: "usd",
      provider: "stripe",
      status: "pending",
      external_id: null,
      checkout_url: "",
      note: paymentNote,
    };

    let { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert(insertPayload)
      .select("*")
      .single();

    if (paymentError && /base_amount|platform_fee|amount_total|column/i.test(paymentError.message || "")) {
      const legacyPayload = {
        user_id: ownerId,
        created_by_id: ownerId,
        invoice_id: invoiceId,
        customer_name: invoice.customer_name || "",
        amount,
        currency: "usd",
        provider: "stripe",
        status: "pending",
        external_id: null,
        checkout_url: "",
        note: paymentNote,
      };
      const retry = await admin.from("payments").insert(legacyPayload).select("*").single();
      payment = retry.data;
      paymentError = retry.error;
    }

    if (paymentError || !payment?.id) {
      logError("portalPayInvoice:payment_insert_failed", {
        message: paymentError?.message || "payment row not created",
        invoiceId,
      });
      return res.status(500).json({ error: "Could not initialize payment" });
    }

    const reconciliationMetadata = {
      invoice_id: invoiceId,
      payment_id: payment.id,
      invoice_owner_id: ownerId,
      user_id: ownerId,
      customer_id: String(auth.session.customer_id),
      source: "portal",
      base_amount: String(amount),
      platform_fee: "0",
    };

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${origin}/portal?paid=1`);
    params.append("cancel_url", `${origin}/portal?paid=0`);
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][product_data][name]", invoice.invoice_number || "Invoice");
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
    params.append("line_items[0][quantity]", "1");
    params.append("client_reference_id", invoiceId);
    for (const [key, value] of Object.entries(reconciliationMetadata)) {
      params.append(`metadata[${key}]`, value);
      params.append(`payment_intent_data[metadata][${key}]`, value);
    }

    const stripeHeaders = {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `portal_checkout_${payment.id}`,
    };

    let response;
    try {
      response = await requestStripeCheckout(params, stripeHeaders);
    } catch (providerError) {
      const timedOut = isAbortError(providerError);
      await admin
        .from("payments")
        .update({
          status: "pending",
          note: `${paymentNote} · Stripe checkout result unconfirmed (${timedOut ? "timeout" : "network error"})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
      logError("portalPayInvoice:stripe_transport", {
        message: providerError?.message || String(providerError),
        paymentId: payment.id,
      });
      return res.status(timedOut ? 504 : 502).json({
        error: timedOut
          ? "Checkout provider timed out. The payment remains pending for reconciliation; check with your provider before trying again."
          : "Checkout provider could not be reached. The payment remains pending for reconciliation; check with your provider before trying again.",
        code: timedOut ? "STRIPE_CHECKOUT_TIMEOUT" : "STRIPE_CHECKOUT_NETWORK_ERROR",
      });
    }

    const session = await response.json();
    if (!response.ok) {
      await admin
        .from("payments")
        .update({
          status: "failed",
          note: `${paymentNote} · Stripe checkout failed`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
      logError("portalPayInvoice:stripe_checkout_failed", {
        message: session?.error?.message || "checkout failed",
        paymentId: payment.id,
      });
      return res.status(502).json({ error: "Could not create checkout session" });
    }

    const { error: paymentUpdateError } = await admin
      .from("payments")
      .update({
        external_id: session.id,
        checkout_url: session.url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);
    if (paymentUpdateError) {
      // Checkout exists in Stripe, so do not create another one. Return the
      // verified URL and let webhook metadata reconcile by payment_id.
      logError("portalPayInvoice:payment_checkout_link_update_failed", {
        message: paymentUpdateError.message,
        paymentId: payment.id,
        checkoutId: session.id,
      });
    }

    await admin.from("portal_actions").insert({
      customer_id: auth.session.customer_id,
      action: "pay_invoice_checkout",
      entity_type: "invoice",
      entity_id: invoiceId,
      meta: {
        amount,
        checkout_id: session.id,
        payment_id: payment.id,
        owner_id: auth.session.created_by_id,
      },
    });

    // Never mark paid here — only the verified Stripe webhook may settle it.
    return res.status(200).json({ url: session.url, checkout: true });
  } catch (error) {
    logError("portalPayInvoice", { message: error?.message || String(error) });
    captureApiException(error, { tags: { route: "portalPayInvoice" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
