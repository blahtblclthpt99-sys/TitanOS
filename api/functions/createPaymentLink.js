import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin } from "../_lib/cors.js";
import { calculateCategoryFees } from "../_lib/feeConfig.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";

function resolvePlanFromProfile(profile, authUser) {
  if (authUser?.app_metadata?.role === "admin" || profile?.role === "admin") return "business";
  const raw = String(profile?.plan_tier || profile?.account_type || "").toLowerCase();
  if (raw === "customer" || profile?.account_type === "customer") return "customer";
  if (raw === "business") return "business";
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
    const currency = (body.currency || "usd").toLowerCase();
    const origin = resolveAppOrigin(req);

    // Never attach an invoice the caller does not own (webhook would mark it paid).
    // When charging an invoice, ALWAYS use server balance_due — ignore client amount.
    let invoiceId = body.invoice_id || null;
    let amount = Number(body.amount);
    if (invoiceId) {
      const { data: invoice, error: invErr } = await admin
        .from("invoices")
        .select("id, created_by_id, status, balance_due, total")
        .eq("id", invoiceId)
        .maybeSingle();
      if (invErr || !invoice) {
        return res.status(400).json({ error: "Invoice not found" });
      }
      if (invoice.created_by_id !== user.id && profile?.role !== "admin" && user.app_metadata?.role !== "admin") {
        return res.status(403).json({ error: "Not allowed to charge this invoice" });
      }
      if (invoice.status === "paid") {
        return res.status(400).json({ error: "Invoice is already paid" });
      }
      const due = Number(invoice.balance_due ?? invoice.total ?? 0);
      if (!Number.isFinite(due) || due <= 0) {
        return res.status(400).json({ error: "Invoice has no balance due" });
      }
      amount = due;
      invoiceId = invoice.id;
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

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        error: "Stripe is not configured. Set STRIPE_SECRET_KEY before accepting live payments.",
        setupRequired: true,
      });
    }

    // Ignore any client-supplied fee / total — recalculate from Fee Engine.
    // Module installs use marketplace_sales (0%) so checkout totals $1.99 flat.
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
    const insertPayload = {
      user_id: user.id,
      invoice_id: invoiceId,
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
      note: body.note ? `${body.note} · ${feeNote}` : feeNote,
      created_by_id: user.id,
    };

    let { data: payment, error } = await admin
      .from("payments")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error && /base_amount|platform_fee|amount_total|column/i.test(error.message || "")) {
      const legacy = {
        user_id: insertPayload.user_id,
        invoice_id: insertPayload.invoice_id,
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
      payment = retry.data
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

    if (error) return res.status(400).json({ error: error.message });

    try {
      await admin.from("fee_calculation_logs").insert({
        transaction_id: payment.id,
        payment_id: payment.id,
        category_id: "service_requests",
        fee_rule_id:
          typeof feeResult.rule?.id === "string" && feeResult.rule.id.startsWith("seed-")
            ? null
            : feeResult.rule?.id || null,
        fee_version: feeResult.feeVersion,
        context_key: planId,
        applied_rules: feeResult.appliedRules,
        gross_amount: base,
        platform_fee: fee,
        processing_fee: feeResult.processingFee,
        tax_amount: feeResult.taxAmount,
        net_amount: feeResult.netAmount,
        final_total: total,
        currency,
        context: { planId, endpoint: "createPaymentLink", source: feeResult.configSource },
        created_by_id: user.id,
      });
    } catch {
      /* audit optional until migration 017 */
    }

    let checkoutUrl = "";
    let externalId = null;

    if (provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
      const params = new URLSearchParams();
      params.set("mode", "payment");
      params.set("success_url", `${origin}/payments?success=1`);
      params.set("cancel_url", `${origin}/payments?canceled=1`);

      const productName = body.customer_name
        ? `Invoice for ${body.customer_name}`
        : "TitanOS Payment";
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

      if (invoiceId) {
        params.set("client_reference_id", invoiceId);
        params.set("metadata[invoice_id]", invoiceId);
      }
      if (payment?.id) params.set("metadata[payment_id]", payment.id);
      params.set("metadata[platform_fee_rate]", String(rate));
      params.set("metadata[plan]", planId);
      params.set("metadata[base_amount]", String(base));
      params.set("metadata[platform_fee]", String(fee));
      params.set("metadata[fee_version]", String(feeResult.feeVersion ?? ""));
      params.set("metadata[fee_config_source]", feeResult.configSource || "seed");
      params.set("metadata[user_id]", user.id);

      const stripeHeaders = {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      };
      if (payment?.id) stripeHeaders["Idempotency-Key"] = `checkout_${payment.id}`;

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: stripeHeaders,
        body: params.toString(),
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        await admin
          .from("payments")
          .update({
            status: "failed",
            note: `${insertPayload.note} · Stripe checkout failed`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);
        const { logError } = await import("../_lib/safeLog.js");
        logError("createPaymentLink:stripe", session.error || session);
        return res.status(502).json({
          error: "Checkout could not be created. Please try again.",
          code: "STRIPE_CHECKOUT_FAILED",
        });
      }
      checkoutUrl = session.url;
      externalId = session.id;

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
      else {
        payment = { ...payment, external_id: externalId, checkout_url: checkoutUrl };
      }
    }

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
