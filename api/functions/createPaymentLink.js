import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin } from "../_lib/cors.js";
import { calculateCategoryFees } from "../_lib/feeConfig.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { fetchWithTimeout, isAbortError } from "../_lib/fetchTimeout.js";
import { logError } from "../_lib/safeLog.js";

const STRIPE_CHECKOUT_TIMEOUT_MS = 10_000;
const SAFE_IDEMPOTENCY_RETRY_MS = 23 * 60 * 60 * 1000;

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

function resolvePlanFromProfile(profile, authUser) {
  if (authUser?.app_metadata?.role === "admin" || profile?.role === "admin") return "business";
  const raw = String(profile?.plan_tier || profile?.account_type || "").toLowerCase();
  if (raw === "customer" || profile?.account_type === "customer") return "customer";
  if (raw === "business") return "business";
  if (raw === "starter") return "starter";
  if (
    raw === "worker_premium" ||
    raw === "premium" ||
    raw === "pro" ||
    profile?.paying_subscriber ||
    profile?.lifetime_premium
  ) {
    return "worker_premium";
  }
  if (profile?.is_pro) return "worker_premium";
  return "worker_free";
}

function claimErrorResponse(error) {
  const message = String(error?.message || error || "");
  if (/standard_invoice_not_found|standard_invoice_owner_mismatch/i.test(message)) {
    return { status: 400, body: { error: "Invoice not found" } };
  }
  if (/standard_invoice_not_payable/i.test(message)) {
    return { status: 409, body: { error: "Invoice is not payable" } };
  }
  if (/standard_invoice_balance_inconsistent|standard_invoice_amount_changed/i.test(message)) {
    return {
      status: 409,
      body: {
        error: "Invoice balance changed. Refresh before creating another checkout.",
        code: "INVOICE_BALANCE_CHANGED",
      },
    };
  }
  if (/standard_checkout_pending_terms_conflict/i.test(message)) {
    return {
      status: 409,
      body: {
        error: "A pending checkout exists with different financial terms. Reconcile it before creating another checkout.",
        code: "PAYMENT_RECONCILIATION_REQUIRED",
      },
    };
  }
  if (/standard_checkout_invalid_terms|standard_checkout_total_mismatch|standard_invoice_invalid_balance/i.test(message)) {
    return { status: 400, body: { error: "Invoice has invalid payment terms" } };
  }
  return null;
}

async function claimStandardInvoicePayment(admin, {
  invoiceId,
  invoiceOwnerId,
  actorId,
  customerName,
  currency,
  base,
  fee,
  rate,
  total,
  note,
}) {
  const { data, error } = await admin.rpc("claim_standard_invoice_payment", {
    p_invoice_id: invoiceId,
    p_owner_id: invoiceOwnerId,
    p_actor_id: actorId,
    p_customer_name: customerName || "",
    p_currency: currency,
    p_base_amount: base,
    p_platform_fee: fee,
    p_platform_fee_rate: rate,
    p_amount_total: total,
    p_note: note,
  });
  if (error) return { error };
  const claim = Array.isArray(data) ? data[0] : data;
  if (!claim?.payment_id) return { error: new Error("Standard invoice payment claim returned no payment") };
  return { claim };
}

function claimedPaymentToRow(claim, {
  invoiceId,
  invoiceOwnerId,
  actorId,
  customerName,
  currency,
  note,
}) {
  return {
    id: claim.payment_id,
    user_id: invoiceOwnerId,
    created_by_id: invoiceOwnerId,
    initiated_by_id: actorId,
    invoice_id: invoiceId,
    customer_name: customerName || "",
    amount: Number(claim.amount_total),
    base_amount: Number(claim.base_amount),
    platform_fee: Number(claim.platform_fee),
    platform_fee_rate: Number(claim.platform_fee_rate),
    amount_total: Number(claim.amount_total),
    currency,
    provider: "stripe",
    status: "pending",
    external_id: claim.external_id || null,
    checkout_url: claim.checkout_url || "",
    note,
    checkout_source: "standard_invoice",
    created_at: claim.claimed_at || null,
    reused: Boolean(claim.reused),
  };
}

/**
 * Creates a Stripe Checkout session when STRIPE_SECRET_KEY is configured.
 * Platform fee ALWAYS computed server-side via Fee Engine (never trusts client fee fields).
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 20, windowMs: 60_000, key: "createPaymentLink" }))) return;

  try {
    const admin = getSupabaseAdmin();
    const body = readJson(req);
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: "Unauthorized" });
    const user = userData.user;

    const { data: profile } = await admin
      .from("profiles")
      .select("role, is_pro, lifetime_premium, paying_subscriber, plan_tier, account_type")
      .eq("id", user.id)
      .maybeSingle();

    const planId = resolvePlanFromProfile(profile, user);
    const currency = String(body.currency || "usd").toLowerCase();
    const origin = resolveAppOrigin(req);
    const actorIsAdmin = profile?.role === "admin" || user.app_metadata?.role === "admin";

    // Never attach an invoice the caller does not own unless the caller is admin.
    // For invoice Checkout, accounting principal is always total - amount_paid;
    // the database claim revalidates this under an invoice row lock.
    let invoiceId = body.invoice_id || null;
    let invoice = null;
    let invoiceOwnerId = user.id;
    let amount = Number(body.amount);

    if (invoiceId) {
      const { data: invoiceRow, error: invErr } = await admin
        .from("invoices")
        .select("id, created_by_id, customer_name, status, balance_due, total, amount_paid")
        .eq("id", invoiceId)
        .maybeSingle();
      if (invErr || !invoiceRow) {
        return res.status(400).json({ error: "Invoice not found" });
      }
      if (!invoiceRow.created_by_id) {
        return res.status(409).json({
          error: "Invoice ownership is incomplete and must be repaired before accepting payment.",
          code: "INVOICE_OWNER_REQUIRED",
        });
      }
      if (String(invoiceRow.created_by_id) !== String(user.id) && !actorIsAdmin) {
        return res.status(403).json({ error: "Not allowed to charge this invoice" });
      }
      if (["paid", "void", "cancelled", "refunded"].includes(String(invoiceRow.status || "").toLowerCase())) {
        return res.status(409).json({ error: "Invoice is not payable" });
      }

      const authoritativeDue = Number(invoiceRow.total || 0) - Number(invoiceRow.amount_paid || 0);
      const storedDue = Number(invoiceRow.balance_due || 0);
      if (
        !Number.isFinite(authoritativeDue) ||
        !Number.isFinite(storedDue) ||
        authoritativeDue <= 0 ||
        Math.abs(authoritativeDue - storedDue) > 0.01
      ) {
        return res.status(409).json({
          error: "Invoice balance is inconsistent. Reconcile the invoice before creating Checkout.",
          code: "INVOICE_BALANCE_INCONSISTENT",
        });
      }

      invoice = invoiceRow;
      invoiceId = invoiceRow.id;
      invoiceOwnerId = String(invoiceRow.created_by_id);
      amount = authoritativeDue;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Valid amount required" });
    }
    if (amount > 1_000_000) {
      return res.status(400).json({ error: "Amount exceeds maximum" });
    }

    const provider = String(body.provider || "stripe").toLowerCase();
    if (provider !== "stripe") {
      return res.status(400).json({
        error: "Only Stripe Checkout is available. Square and PayPal providers are not live yet.",
      });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(503).json({
        error: "Stripe is not configured. Set STRIPE_SECRET_KEY before accepting live payments.",
        setupRequired: true,
      });
    }

    // Ignore any client-supplied fee / total — recalculate from Fee Engine.
    // Legacy purpose=module used marketplace_sales (0%); new modules are subscription-included.
    const purpose = String(body.purpose || "").toLowerCase();
    const categoryId = purpose === "module" ? "marketplace_sales" : "service_requests";
    const contextKey = categoryId === "marketplace_sales" ? "*" : planId;
    const feeResult = await calculateCategoryFees(admin, {
      categoryId,
      contextKey,
      grossAmount: amount,
      userId: user.id,
      currency,
      context: { planId, endpoint: "createPaymentLink", purpose: purpose || "payment" },
      persistLog: false,
    });

    const base = feeResult.gross;
    const fee = feeResult.platformFee;
    const total = feeResult.finalTotal;
    const rate = feeResult.rate;
    const label = feeResult.label;

    const feeNote =
      categoryId === "marketplace_sales"
        ? `Marketplace module $${base.toFixed(2)} (no platform surcharge).`
        : `TitanOS ${planId} fee ${label} ($${fee.toFixed(2)}). Total charged $${total.toFixed(2)}.`;
    const paymentNote = body.note ? `${body.note} · ${feeNote}` : feeNote;

    let payment;
    let paymentReused = false;

    if (invoiceId) {
      let claimResult = await claimStandardInvoicePayment(admin, {
        invoiceId,
        invoiceOwnerId,
        actorId: user.id,
        customerName: body.customer_name || invoice?.customer_name || "",
        currency,
        base,
        fee,
        rate,
        total,
        note: paymentNote,
      });
      if (claimResult.error) {
        const mapped = claimErrorResponse(claimResult.error);
        if (mapped) return res.status(mapped.status).json(mapped.body);
        throw claimResult.error;
      }

      payment = claimedPaymentToRow(claimResult.claim, {
        invoiceId,
        invoiceOwnerId,
        actorId: user.id,
        customerName: body.customer_name || invoice?.customer_name || "",
        currency,
        note: paymentNote,
      });
      paymentReused = Boolean(payment.reused);

      // Reused invoice claims must reconcile the provider Session before any new
      // Stripe create call. This is the second concurrency boundary after the DB lock.
      for (let pass = 0; pass < 3 && paymentReused; pass += 1) {
        if (payment.external_id) {
          let existingResponse;
          try {
            existingResponse = await retrieveStripeCheckout(stripeKey, payment.external_id);
          } catch (providerError) {
            const timedOut = isAbortError(providerError);
            logError("createPaymentLink:stripe_session_lookup_transport", {
              message: providerError?.message || String(providerError),
              paymentId: payment.id,
              checkoutId: payment.external_id,
            });
            return res.status(timedOut ? 504 : 502).json({
              error: "The existing checkout could not be verified. No new checkout was created.",
              code: "PAYMENT_RECONCILIATION_REQUIRED",
            });
          }

          const existingSession = await existingResponse.json();
          if (!existingResponse.ok) {
            logError("createPaymentLink:stripe_session_lookup_failed", {
              status: existingResponse.status,
              paymentId: payment.id,
              checkoutId: payment.external_id,
            });
            return res.status(409).json({
              error: "The existing checkout requires reconciliation before another can be created.",
              code: "PAYMENT_RECONCILIATION_REQUIRED",
            });
          }

          const metadata = existingSession.metadata || {};
          if (
            (existingSession.client_reference_id && String(existingSession.client_reference_id) !== String(invoiceId)) ||
            (metadata.payment_id && String(metadata.payment_id) !== String(payment.id)) ||
            (metadata.invoice_owner_id && String(metadata.invoice_owner_id) !== String(invoiceOwnerId))
          ) {
            logError("createPaymentLink:stripe_session_linkage_mismatch", {
              paymentId: payment.id,
              invoiceId,
              checkoutId: existingSession.id || payment.external_id,
            });
            return res.status(409).json({
              error: "The existing checkout has inconsistent reconciliation metadata.",
              code: "PAYMENT_RECONCILIATION_REQUIRED",
            });
          }

          if (existingSession.status === "open" && existingSession.url) {
            return res.status(200).json({
              payment: {
                ...payment,
                external_id: existingSession.id,
                checkout_url: existingSession.url,
                plan: planId,
              },
              fee: {
                rate,
                label,
                base,
                platform_fee: fee,
                amount_total: total,
                plan: planId,
                fee_version: feeResult.feeVersion,
                config_source: feeResult.configSource,
                applied_rules: feeResult.appliedRules,
              },
              setupRequired: false,
              reused: true,
              message: "Existing invoice checkout reused.",
            });
          }

          if (existingSession.status === "complete") {
            return res.status(409).json({
              error: "This checkout has already completed and is being reconciled. Refresh Payments shortly.",
              code: "PAYMENT_SETTLEMENT_PENDING",
            });
          }

          if (existingSession.status === "expired") {
            const { error: cancelError } = await admin
              .from("payments")
              .update({
                status: "canceled",
                note: `${paymentNote} · Stripe checkout expired`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.id)
              .eq("status", "pending");
            if (cancelError) throw cancelError;

            claimResult = await claimStandardInvoicePayment(admin, {
              invoiceId,
              invoiceOwnerId,
              actorId: user.id,
              customerName: body.customer_name || invoice?.customer_name || "",
              currency,
              base,
              fee,
              rate,
              total,
              note: paymentNote,
            });
            if (claimResult.error) {
              const mapped = claimErrorResponse(claimResult.error);
              if (mapped) return res.status(mapped.status).json(mapped.body);
              throw claimResult.error;
            }
            payment = claimedPaymentToRow(claimResult.claim, {
              invoiceId,
              invoiceOwnerId,
              actorId: user.id,
              customerName: body.customer_name || invoice?.customer_name || "",
              currency,
              note: paymentNote,
            });
            paymentReused = Boolean(payment.reused);
            continue;
          }

          return res.status(409).json({
            error: "The existing checkout is in an unknown state. No new checkout was created.",
            code: "PAYMENT_RECONCILIATION_REQUIRED",
          });
        }

        const claimedAt = Date.parse(payment.created_at || "");
        const ageMs = Number.isFinite(claimedAt) ? Date.now() - claimedAt : Number.POSITIVE_INFINITY;
        if (ageMs < 0 || ageMs >= SAFE_IDEMPOTENCY_RETRY_MS) {
          logError("createPaymentLink:stale_unresolved_payment", {
            paymentId: payment.id,
            invoiceId,
            claimedAt: payment.created_at || null,
          });
          return res.status(409).json({
            error: "An older unresolved checkout must be reconciled before another can be created.",
            code: "PAYMENT_RECONCILIATION_REQUIRED",
          });
        }
        break;
      }
    } else {
      const insertPayload = {
        user_id: user.id,
        invoice_id: null,
        customer_name: body.customer_name || "",
        amount: total,
        base_amount: base,
        platform_fee: fee,
        platform_fee_rate: rate,
        amount_total: total,
        currency,
        provider,
        status: "pending",
        external_id: null,
        checkout_url: "",
        note: paymentNote,
        created_by_id: user.id,
      };

      let { data: insertedPayment, error } = await admin
        .from("payments")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error && /base_amount|platform_fee|amount_total|column/i.test(error.message || "")) {
        const legacy = {
          user_id: insertPayload.user_id,
          invoice_id: null,
          customer_name: insertPayload.customer_name,
          amount: total,
          currency,
          provider,
          status: "pending",
          external_id: null,
          checkout_url: "",
          note: insertPayload.note,
          created_by_id: user.id,
        };
        const retry = await admin.from("payments").insert(legacy).select("*").single();
        insertedPayment = retry.data
          ? {
              ...retry.data,
              base_amount: base,
              platform_fee: fee,
              platform_fee_rate: rate,
              amount_total: total,
              plan: planId,
            }
          : null;
        error = retry.error;
      }

      if (error || !insertedPayment) {
        return res.status(400).json({ error: error?.message || "Could not initialize payment" });
      }
      payment = insertedPayment;
    }

    // Persist fee audit once per payment identity; concurrent invoice callers
    // reuse the same payment row and therefore must not duplicate fee logs.
    if (!paymentReused) {
      try {
        await admin.from("fee_calculation_logs").insert({
          transaction_id: payment.id,
          payment_id: payment.id,
          category_id: categoryId,
          fee_rule_id:
            typeof feeResult.rule?.id === "string" && feeResult.rule.id.startsWith("seed-")
              ? null
              : feeResult.rule?.id || null,
          fee_version: feeResult.feeVersion,
          context_key: contextKey,
          applied_rules: feeResult.appliedRules,
          gross_amount: base,
          platform_fee: fee,
          processing_fee: feeResult.processingFee,
          tax_amount: feeResult.taxAmount,
          net_amount: feeResult.netAmount,
          final_total: total,
          currency,
          context: {
            planId,
            endpoint: "createPaymentLink",
            source: feeResult.configSource,
            invoiceOwnerId: invoiceId ? invoiceOwnerId : null,
            initiatedById: user.id,
          },
          created_by_id: user.id,
        });
      } catch {
        /* audit optional until migration 017 */
      }
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${origin}/payments?success=1`);
    params.set("cancel_url", `${origin}/payments?canceled=1`);

    const customerName = body.customer_name || invoice?.customer_name || "";
    const productName = customerName ? `Invoice for ${customerName}` : "TitanOS Payment";
    params.set("line_items[0][price_data][currency]", currency);
    params.set("line_items[0][price_data][product_data][name]", productName);
    params.set("line_items[0][price_data][unit_amount]", String(Math.round(base * 100)));
    params.set("line_items[0][quantity]", "1");

    if (fee > 0) {
      params.set("line_items[1][price_data][currency]", currency);
      params.set(
        "line_items[1][price_data][product_data][name]",
        `TitanOS ${planId} platform fee (${label})`
      );
      params.set("line_items[1][price_data][unit_amount]", String(Math.round(fee * 100)));
      params.set("line_items[1][quantity]", "1");
    }

    if (invoiceId) params.set("client_reference_id", invoiceId);

    const paymentOwnerId = invoiceId ? invoiceOwnerId : user.id;
    const reconciliationMetadata = {
      payment_id: String(payment.id),
      user_id: String(paymentOwnerId),
      initiated_by_id: String(user.id),
      source: "createPaymentLink",
      platform_fee_rate: String(rate),
      plan: planId,
      base_amount: String(base),
      platform_fee: String(fee),
      fee_version: String(feeResult.feeVersion ?? ""),
      fee_config_source: feeResult.configSource || "seed",
    };
    if (invoiceId) {
      reconciliationMetadata.invoice_id = String(invoiceId);
      reconciliationMetadata.invoice_owner_id = String(invoiceOwnerId);
    }
    for (const [key, value] of Object.entries(reconciliationMetadata)) {
      params.set(`metadata[${key}]`, value);
      params.set(`payment_intent_data[metadata][${key}]`, value);
    }

    const stripeHeaders = {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `checkout_${payment.id}`,
    };

    let stripeRes;
    try {
      stripeRes = await requestStripeCheckout(params, stripeHeaders);
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
      logError("createPaymentLink:stripe_transport", {
        message: providerError?.message || String(providerError),
        paymentId: payment.id,
        invoiceId,
      });
      return res.status(timedOut ? 504 : 502).json({
        error: timedOut
          ? "Checkout provider timed out. The payment remains pending for reconciliation; check Payments before trying again."
          : "Checkout provider could not be reached. The payment remains pending for reconciliation; check Payments before trying again.",
        code: timedOut ? "STRIPE_CHECKOUT_TIMEOUT" : "STRIPE_CHECKOUT_NETWORK_ERROR",
      });
    }

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      const idempotencyConflict =
        stripeRes.status === 409 || session?.error?.type === "idempotency_error";
      if (idempotencyConflict) {
        logError("createPaymentLink:stripe_idempotency_in_progress", {
          paymentId: payment.id,
          invoiceId,
          status: stripeRes.status,
        });
        return res.status(409).json({
          error: "This checkout is already being initialized. Try again shortly.",
          code: "CHECKOUT_INITIALIZING",
        });
      }

      await admin
        .from("payments")
        .update({
          status: "failed",
          note: `${paymentNote} · Stripe checkout failed`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
      logError("createPaymentLink:stripe", {
        message: session?.error?.message || "checkout failed",
        paymentId: payment.id,
        invoiceId,
      });
      return res.status(502).json({
        error: "Checkout could not be created. Please try again.",
        code: "STRIPE_CHECKOUT_FAILED",
      });
    }

    const checkoutUrl = session.url;
    const externalId = session.id;
    const { data: updated, error: updErr } = await admin
      .from("payments")
      .update({
        external_id: externalId,
        checkout_url: checkoutUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select("*")
      .single();
    if (!updErr && updated) payment = { ...payment, ...updated };
    else payment = { ...payment, external_id: externalId, checkout_url: checkoutUrl };

    return res.status(200).json({
      payment: { ...payment, plan: planId },
      fee: {
        rate,
        label,
        base,
        platform_fee: fee,
        amount_total: total,
        plan: planId,
        fee_version: feeResult.feeVersion,
        config_source: feeResult.configSource,
        applied_rules: feeResult.appliedRules,
      },
      setupRequired: !checkoutUrl,
      reused: paymentReused,
      message: checkoutUrl
        ? `Checkout created with ${label} ${planId} fee`
        : "Payment recorded as pending.",
    });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "createPaymentLink",
      category: "payments",
      publicMessage: "Payment link failed",
      publicCode: "PAYMENT_LINK_FAILED",
    });
  }
}
