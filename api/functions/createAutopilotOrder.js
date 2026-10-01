import { createHash } from "node:crypto";
import Stripe from "stripe";
import { applyCors, handleOptions, resolveAppOrigin } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

const SPRINT_PRICE_CENTS = 900;
const MAX_INVOICES = 10;
const STRIPE_TIMEOUT_MS = 10_000;
const SAFE_IDEMPOTENCY_RETRY_MS = 23 * 60 * 60 * 1000;
const TERMINAL_INVOICE_STATUSES = new Set(["paid", "void", "cancelled", "refunded"]);

function checkoutKeyFor(invoiceIds) {
  const digest = createHash("sha256").update(invoiceIds.join(",")).digest("hex");
  return `invoice_recovery_sprint:v1:${digest}`;
}

function invoicePrincipal(invoice) {
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.amount_paid || 0);
  const stored = Number(invoice.balance_due || 0);
  const due = total - paid;
  return { total, paid, stored, due };
}

function validInvoiceForSprint(invoice, today) {
  if (!invoice?.customer_email || !invoice?.due_date || invoice.due_date >= today) return false;
  if (TERMINAL_INVOICE_STATUSES.has(String(invoice.status || "").toLowerCase())) return false;
  const { total, paid, stored, due } = invoicePrincipal(invoice);
  return (
    Number.isFinite(total) &&
    Number.isFinite(paid) &&
    Number.isFinite(stored) &&
    Number.isFinite(due) &&
    due > 0 &&
    Math.abs(stored - due) <= 0.01
  );
}

async function claimOrder(auth, { checkoutKey, invoiceIds, approvedRecipients, note }) {
  const { data, error } = await auth.admin.rpc("claim_titan_auto_order", {
    p_user_id: auth.user.id,
    p_checkout_key: checkoutKey,
    p_invoice_ids: invoiceIds,
    p_approved_recipients: approvedRecipients,
    p_note: note,
  });
  if (error) return { error };
  const claim = Array.isArray(data) ? data[0] : data;
  if (!claim?.payment_id || !claim?.order_id) {
    return { error: new Error("Titan Auto order claim returned no identity") };
  }
  return { claim };
}

async function cancelUnstartedClaim(auth, claim, reason) {
  await auth.admin
    .from("payments")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", claim.payment_id)
    .eq("status", "pending");
  await auth.admin
    .from("titan_auto_orders")
    .update({ state: "cancelled", last_error: reason, updated_at: new Date().toISOString() })
    .eq("id", claim.order_id)
    .eq("state", "awaiting_payment");
}

function sessionLinkageMatches(session, claim, checkoutKey, userId) {
  const meta = session?.metadata || {};
  return (
    (!meta.payment_id || String(meta.payment_id) === String(claim.payment_id)) &&
    (!meta.order_id || String(meta.order_id) === String(claim.order_id)) &&
    (!meta.user_id || String(meta.user_id) === String(userId)) &&
    (!meta.checkout_key || String(meta.checkout_key) === String(checkoutKey))
  );
}

async function resolveConfiguredLineItem(stripe) {
  const configuredPriceId = String(process.env.STRIPE_AUTOPILOT_PRICE_ID || "").trim();
  if (!configuredPriceId) {
    return {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: SPRINT_PRICE_CENTS,
        product_data: {
          name: "Titan Auto — Invoice Recovery Sprint",
          description: "One approved recovery sprint for up to 10 overdue invoices.",
        },
      },
    };
  }

  let price;
  try {
    price = await stripe.prices.retrieve(configuredPriceId);
  } catch (error) {
    logError("createAutopilotOrder:price_lookup", {
      message: error?.message || String(error),
      priceId: configuredPriceId,
    });
    const providerError = new Error("Configured Titan Auto price could not be verified");
    providerError.code = "AUTOPILOT_PRICE_UNVERIFIED";
    throw providerError;
  }

  const valid =
    price?.active !== false &&
    String(price?.currency || "").toLowerCase() === "usd" &&
    Number(price?.unit_amount) === SPRINT_PRICE_CENTS &&
    price?.type === "one_time";
  if (!valid) {
    logError("createAutopilotOrder:price_mismatch", {
      priceId: configuredPriceId,
      active: price?.active,
      currency: price?.currency,
      unitAmount: price?.unit_amount,
      type: price?.type,
    });
    const mismatch = new Error("Configured Titan Auto price does not match the $9 USD one-time product");
    mismatch.code = "AUTOPILOT_PRICE_MISMATCH";
    throw mismatch;
  }

  return { quantity: 1, price: configuredPriceId };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 8, windowMs: 60_000, key: "createAutopilotOrder" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Titan Auto checkout is not configured" });

  try {
    const body = readJson(req);
    const invoiceIds = [...new Set(Array.isArray(body.invoice_ids) ? body.invoice_ids.map(String) : [])]
      .sort()
      .slice(0, MAX_INVOICES);
    if (!invoiceIds.length) return res.status(400).json({ error: "Select at least one overdue invoice" });

    const { data: invoices, error: invoiceError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,amount_paid,due_date,created_by_id")
      .in("id", invoiceIds)
      .eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;
    if ((invoices || []).length !== invoiceIds.length) {
      return res.status(403).json({ error: "One or more invoices are unavailable" });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (!(invoices || []).every((invoice) => validInvoiceForSprint(invoice, today))) {
      return res.status(400).json({
        error: "Every selection must be overdue, unpaid, balance-consistent, and have a customer email",
      });
    }

    const approvedRecipients = Object.fromEntries(
      (invoices || []).map((invoice) => [String(invoice.id), String(invoice.customer_email || "").trim()])
    );

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      timeout: STRIPE_TIMEOUT_MS,
      maxNetworkRetries: 1,
    });

    let lineItem;
    try {
      lineItem = await resolveConfiguredLineItem(stripe);
    } catch (priceError) {
      return res.status(503).json({
        error: "Titan Auto pricing is not safely configured. No checkout was created.",
        code: priceError?.code || "AUTOPILOT_PRICE_UNVERIFIED",
      });
    }

    const checkoutKey = checkoutKeyFor(invoiceIds);
    const legacyOrderNote = `AUTOPILOT:${JSON.stringify({
      type: "invoice_recovery_sprint",
      state: "awaiting_payment",
      invoice_ids: invoiceIds,
      approved_at: new Date().toISOString(),
      price_cents: SPRINT_PRICE_CENTS,
      checkout_key: checkoutKey,
    })}`;

    let claimResult = await claimOrder(auth, {
      checkoutKey,
      invoiceIds,
      approvedRecipients,
      note: legacyOrderNote,
    });
    if (claimResult.error) throw claimResult.error;
    let claim = claimResult.claim;

    for (let pass = 0; pass < 3 && claim.reused; pass += 1) {
      if (claim.external_id) {
        let existingSession;
        try {
          existingSession = await stripe.checkout.sessions.retrieve(claim.external_id);
        } catch (error) {
          logError("createAutopilotOrder:checkout_lookup", {
            message: error?.message || String(error),
            paymentId: claim.payment_id,
            checkoutId: claim.external_id,
          });
          return res.status(409).json({
            error: "The existing Titan Auto checkout needs reconciliation before another can be created.",
            code: "PAYMENT_RECONCILIATION_REQUIRED",
          });
        }

        if (!sessionLinkageMatches(existingSession, claim, checkoutKey, auth.user.id)) {
          logError("createAutopilotOrder:checkout_linkage_mismatch", {
            paymentId: claim.payment_id,
            orderId: claim.order_id,
            checkoutId: existingSession.id,
          });
          return res.status(409).json({
            error: "The existing Titan Auto checkout has inconsistent reconciliation metadata.",
            code: "PAYMENT_RECONCILIATION_REQUIRED",
          });
        }

        if (existingSession.status === "open" && existingSession.url) {
          return res.status(200).json({
            order_id: claim.payment_id,
            order_ledger_id: claim.order_id,
            checkout_url: existingSession.url,
            amount: SPRINT_PRICE_CENTS / 100,
            invoice_count: invoiceIds.length,
            reused: true,
          });
        }
        if (existingSession.status === "complete") {
          return res.status(409).json({
            error: "This Titan Auto checkout already completed and is being reconciled.",
            code: "PAYMENT_SETTLEMENT_PENDING",
          });
        }
        if (existingSession.status === "expired") {
          await cancelUnstartedClaim(auth, claim, "Stripe checkout expired before payment");
          claimResult = await claimOrder(auth, {
            checkoutKey,
            invoiceIds,
            approvedRecipients,
            note: legacyOrderNote,
          });
          if (claimResult.error) throw claimResult.error;
          claim = claimResult.claim;
          continue;
        }
        return res.status(409).json({
          error: "The existing Titan Auto checkout is in an unknown state.",
          code: "PAYMENT_RECONCILIATION_REQUIRED",
        });
      }

      const claimedAt = Date.parse(claim.claimed_at || "");
      const ageMs = Number.isFinite(claimedAt) ? Date.now() - claimedAt : Number.POSITIVE_INFINITY;
      if (ageMs < 0 || ageMs >= SAFE_IDEMPOTENCY_RETRY_MS) {
        logError("createAutopilotOrder:stale_unresolved_checkout", {
          paymentId: claim.payment_id,
          orderId: claim.order_id,
          claimedAt: claim.claimed_at || null,
        });
        return res.status(409).json({
          error: "An older unresolved Titan Auto checkout must be reconciled before another can be created.",
          code: "PAYMENT_RECONCILIATION_REQUIRED",
        });
      }
      break;
    }

    const origin = resolveAppOrigin(req);
    const reconciliationMetadata = {
      payment_id: String(claim.payment_id),
      order_id: String(claim.order_id),
      user_id: String(auth.user.id),
      task_type: "invoice_recovery_sprint",
      checkout_key: checkoutKey,
      price_cents: String(SPRINT_PRICE_CENTS),
      currency: "usd",
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: auth.user.email || undefined,
        line_items: [lineItem],
        metadata: reconciliationMetadata,
        payment_intent_data: { metadata: reconciliationMetadata },
        success_url: `${origin}/titan-auto?order=${encodeURIComponent(claim.payment_id)}&checkout=success`,
        cancel_url: `${origin}/titan-auto?order=${encodeURIComponent(claim.payment_id)}&checkout=canceled`,
      }, { idempotencyKey: `autopilot_${claim.payment_id}` });
    } catch (error) {
      logError("createAutopilotOrder:stripe_checkout_unconfirmed", {
        message: error?.message || String(error),
        paymentId: claim.payment_id,
        orderId: claim.order_id,
      });
      return res.status(502).json({
        error: "Titan Auto checkout could not be confirmed. The pending payment was preserved for safe retry.",
        code: "AUTOPILOT_CHECKOUT_UNCONFIRMED",
      });
    }

    const { error: updateError } = await auth.admin
      .from("payments")
      .update({ external_id: session.id, checkout_url: session.url, updated_at: new Date().toISOString() })
      .eq("id", claim.payment_id)
      .eq("status", "pending");
    if (updateError) {
      logError("createAutopilotOrder:checkout_link_update", {
        message: updateError.message,
        paymentId: claim.payment_id,
        checkoutId: session.id,
      });
    }

    return res.status(200).json({
      order_id: claim.payment_id,
      order_ledger_id: claim.order_id,
      checkout_url: session.url,
      amount: SPRINT_PRICE_CENTS / 100,
      invoice_count: invoiceIds.length,
      reused: Boolean(claim.reused),
    });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "createAutopilotOrder",
      category: "payments",
      publicMessage: "Titan Auto checkout could not be created",
      publicCode: "AUTOPILOT_CHECKOUT_FAILED",
    });
  }
}
