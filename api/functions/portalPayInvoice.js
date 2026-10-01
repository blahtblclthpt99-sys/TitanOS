import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin, allowedOrigins } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { requirePortalSession } from "../_lib/requirePortalSession.js";
import { fetchWithTimeout, isAbortError } from "../_lib/fetchTimeout.js";
import { logError } from "../_lib/safeLog.js";

const STRIPE_CHECKOUT_TIMEOUT_MS = 10_000;
const SAFE_IDEMPOTENCY_RETRY_MS = 23 * 60 * 60 * 1000;
const PAYMENT_NOTE = "Customer portal invoice payment (no TitanOS platform fee).";

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

async function retrieveStripeCheckout(stripeKey, sessionId) {
  return fetchWithTimeout(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
    STRIPE_CHECKOUT_TIMEOUT_MS
  );
}

async function claimPortalPayment(admin, { invoiceId, ownerId, customerId, customerName }) {
  const { data, error } = await admin.rpc("claim_portal_invoice_payment", {
    p_invoice_id: invoiceId,
    p_owner_id: ownerId,
    p_customer_id: String(customerId),
    p_customer_name: customerName || "",
    p_currency: "usd",
  });
  if (error) return { error };
  const claim = Array.isArray(data) ? data[0] : data;
  if (!claim?.payment_id) return { error: new Error("Portal payment claim returned no payment") };
  return { claim };
}

function portalClaimHttpError(error) {
  const message = String(error?.message || error || "");
  if (/portal_invoice_not_found|portal_invoice_ownership_mismatch/i.test(message)) {
    return { status: 404, body: { error: "Invoice not found" } };
  }
  if (/portal_invoice_not_payable/i.test(message)) {
    return { status: 409, body: { error: "Invoice is not payable" } };
  }
  if (/portal_invoice_invalid_balance/i.test(message)) {
    return { status: 409, body: { error: "Invoice balance changed. Refresh and try again." } };
  }
  if (/portal_checkout_pending_amount_conflict/i.test(message)) {
    return {
      status: 409,
      body: {
        error: "A different payment attempt is already pending for this invoice. Refresh before trying again.",
        code: "PAYMENT_RECONCILIATION_REQUIRED",
      },
    };
  }
  return null;
}

async function recordPortalCheckoutAction(admin, { customerId, invoiceId, paymentId, ownerId, amount, checkoutId, reused }) {
  const { error } = await admin.from("portal_actions").insert({
    customer_id: customerId,
    action: reused ? "pay_invoice_checkout_reused" : "pay_invoice_checkout",
    entity_type: "invoice",
    entity_id: invoiceId,
    meta: {
      amount,
      checkout_id: checkoutId || null,
      payment_id: paymentId,
      owner_id: ownerId,
    },
  });
  if (error) {
    logError("portalPayInvoice:portal_action_failed", {
      message: error.message,
      invoiceId,
      paymentId,
    });
  }
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

    const ownerId = String(auth.session.created_by_id);
    const customerId = String(auth.session.customer_id || "");
    let claimResult = await claimPortalPayment(admin, {
      invoiceId,
      ownerId,
      customerId,
      customerName: invoice.customer_name,
    });
    if (claimResult.error) {
      const mapped = portalClaimHttpError(claimResult.error);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw claimResult.error;
    }

    let payment = claimResult.claim;
    let reused = Boolean(payment.reused);

    if (reused && payment.external_id) {
      let existingResponse;
      try {
        existingResponse = await retrieveStripeCheckout(stripeKey, payment.external_id);
      } catch (providerError) {
        const timedOut = isAbortError(providerError);
        logError("portalPayInvoice:stripe_session_lookup_transport", {
          message: providerError?.message || String(providerError),
          paymentId: payment.payment_id,
          checkoutId: payment.external_id,
        });
        return res.status(timedOut ? 504 : 502).json({
          error: "The existing payment attempt could not be verified. No new checkout was created.",
          code: "PAYMENT_RECONCILIATION_REQUIRED",
        });
      }

      const existingSession = await existingResponse.json();
      if (!existingResponse.ok) {
        logError("portalPayInvoice:stripe_session_lookup_failed", {
          status: existingResponse.status,
          paymentId: payment.payment_id,
          checkoutId: payment.external_id,
        });
        return res.status(409).json({
          error: "The existing payment attempt needs reconciliation before another checkout can be created.",
          code: "PAYMENT_RECONCILIATION_REQUIRED",
        });
      }

      if (existingSession.status === "open" && existingSession.url) {
        await recordPortalCheckoutAction(admin, {
          customerId,
          invoiceId,
          paymentId: payment.payment_id,
          ownerId,
          amount: Number(payment.amount),
          checkoutId: existingSession.id,
          reused: true,
        });
        return res.status(200).json({ url: existingSession.url, checkout: true, reused: true });
      }

      if (existingSession.status === "complete") {
        return res.status(409).json({
          error: "This payment has already been submitted and is being reconciled. Refresh your invoices shortly.",
          code: "PAYMENT_SETTLEMENT_PENDING",
        });
      }

      if (existingSession.status === "expired") {
        const { error: cancelError } = await admin
          .from("payments")
          .update({
            status: "canceled",
            note: `${PAYMENT_NOTE} · Stripe checkout expired`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.payment_id)
          .eq("status", "pending");
        if (cancelError) throw cancelError;

        claimResult = await claimPortalPayment(admin, {
          invoiceId,
          ownerId,
          customerId,
          customerName: invoice.customer_name,
        });
        if (claimResult.error) {
          const mapped = portalClaimHttpError(claimResult.error);
          if (mapped) return res.status(mapped.status).json(mapped.body);
          throw claimResult.error;
        }
        payment = claimResult.claim;
        reused = Boolean(payment.reused);
      } else {
        return res.status(409).json({
          error: "The existing payment attempt is in an unknown state. No new checkout was created.",
          code: "PAYMENT_RECONCILIATION_REQUIRED",
        });
      }
    }

    if (reused && !payment.external_id) {
      const claimedAt = Date.parse(payment.claimed_at || "");
      const ageMs = Number.isFinite(claimedAt) ? Date.now() - claimedAt : Number.POSITIVE_INFINITY;
      if (ageMs < 0 || ageMs >= SAFE_IDEMPOTENCY_RETRY_MS) {
        logError("portalPayInvoice:stale_unresolved_payment", {
          paymentId: payment.payment_id,
          invoiceId,
          claimedAt: payment.claimed_at || null,
        });
        return res.status(409).json({
          error: "An older unresolved payment attempt must be reconciled before another checkout can be created.",
          code: "PAYMENT_RECONCILIATION_REQUIRED",
        });
      }
    }

    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      throw new Error("Invalid amount returned by portal payment claim");
    }

    const reconciliationMetadata = {
      invoice_id: invoiceId,
      payment_id: payment.payment_id,
      invoice_owner_id: ownerId,
      user_id: ownerId,
      customer_id: customerId,
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
      "Idempotency-Key": `portal_checkout_${payment.payment_id}`,
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
          note: `${PAYMENT_NOTE} · Stripe checkout result unconfirmed (${timedOut ? "timeout" : "network error"})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.payment_id);
      logError("portalPayInvoice:stripe_transport", {
        message: providerError?.message || String(providerError),
        paymentId: payment.payment_id,
      });
      return res.status(timedOut ? 504 : 502).json({
        error: "Checkout provider could not be confirmed. The payment remains pending for reconciliation; no second payment was created.",
        code: timedOut ? "STRIPE_CHECKOUT_TIMEOUT" : "STRIPE_CHECKOUT_NETWORK_ERROR",
      });
    }

    const session = await response.json();
    if (!response.ok) {
      const idempotencyConflict =
        response.status === 409 || session?.error?.type === "idempotency_error";
      if (idempotencyConflict) {
        logError("portalPayInvoice:stripe_idempotency_in_progress", {
          paymentId: payment.payment_id,
          status: response.status,
        });
        return res.status(409).json({
          error: "This checkout is already being initialized. Try again in a moment.",
          code: "CHECKOUT_INITIALIZING",
        });
      }

      await admin
        .from("payments")
        .update({
          status: "failed",
          note: `${PAYMENT_NOTE} · Stripe checkout failed`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.payment_id);
      logError("portalPayInvoice:stripe_checkout_failed", {
        message: session?.error?.message || "checkout failed",
        paymentId: payment.payment_id,
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
      .eq("id", payment.payment_id);
    if (paymentUpdateError) {
      // Checkout exists in Stripe, so do not create another one. The stable
      // payment_id remains embedded in PaymentIntent metadata for reconciliation.
      logError("portalPayInvoice:payment_checkout_link_update_failed", {
        message: paymentUpdateError.message,
        paymentId: payment.payment_id,
        checkoutId: session.id,
      });
    }

    await recordPortalCheckoutAction(admin, {
      customerId,
      invoiceId,
      paymentId: payment.payment_id,
      ownerId,
      amount,
      checkoutId: session.id,
      reused,
    });

    // Never mark paid here — only the verified Stripe webhook may settle it.
    return res.status(200).json({ url: session.url, checkout: true, reused });
  } catch (error) {
    logError("portalPayInvoice", { message: error?.message || String(error) });
    captureApiException(error, { tags: { route: "portalPayInvoice" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
