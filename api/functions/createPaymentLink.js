import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

const PLAN_FEES = {
  free: { rate: 0.075, label: "7.5%" },
  premium: { rate: 0.029, label: "2.9%" },
  pro: { rate: 0.025, label: "2.5%" },
};

function resolvePlanFromProfile(profile, authUser) {
  if (authUser?.app_metadata?.role === "admin" || profile?.role === "admin") return "pro";
  if (profile?.lifetime_premium || profile?.is_pro) return "pro";
  if (profile?.paying_subscriber || profile?.plan_tier === "premium") return "premium";
  if (profile?.plan_tier === "pro") return "pro";
  return "free";
}

function calcPlatformFee(amount, planId) {
  const { rate, label } = PLAN_FEES[planId] || PLAN_FEES.free;
  const base = Math.round((Number(amount) || 0) * 100) / 100;
  const fee = Math.round(base * rate * 100) / 100;
  const total = Math.round((base + fee) * 100) / 100;
  return { base, fee, total, rate, label, planId };
}

/**
 * Creates a Stripe Checkout session when STRIPE_SECRET_KEY is configured.
 * Charges base amount + plan-based TitanOS platform fee.
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
      .select("role, is_pro, lifetime_premium, paying_subscriber, plan_tier")
      .eq("id", user.id)
      .maybeSingle();

    const planId = resolvePlanFromProfile(profile, user);
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount required" });

    const { base, fee, total, rate, label } = calcPlatformFee(amount, planId);
    const provider = body.provider || "stripe";
    const currency = (body.currency || "usd").toLowerCase();
    const origin = req.headers.origin || process.env.VITE_APP_URL || "https://titanos-web.vercel.app";

    let checkoutUrl = "";
    let externalId = null;
    let status = "pending";

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

      if (body.invoice_id) params.set("client_reference_id", body.invoice_id);
      params.set("metadata[platform_fee_rate]", String(rate));
      params.set("metadata[plan]", planId);
      params.set("metadata[base_amount]", String(base));
      params.set("metadata[platform_fee]", String(fee));

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        return res.status(400).json({ error: session.error?.message || "Stripe error" });
      }
      checkoutUrl = session.url;
      externalId = session.id;
      status = "pending";
    }

    const feeNote = `TitanOS ${planId} fee ${label} ($${fee.toFixed(2)}). Total charged $${total.toFixed(2)}.`;
    const insertPayload = {
      user_id: user.id,
      invoice_id: body.invoice_id || null,
      customer_name: body.customer_name || "",
      amount: total,
      base_amount: base,
      platform_fee: fee,
      platform_fee_rate: rate,
      amount_total: total,
      currency,
      provider,
      status,
      external_id: externalId,
      checkout_url: checkoutUrl,
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
        status,
        external_id: externalId,
        checkout_url: checkoutUrl,
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

    return res.status(200).json({
      payment: { ...payment, plan: planId },
      fee: { rate, label, base, platform_fee: fee, amount_total: total, plan: planId },
      setupRequired: !checkoutUrl,
      message: checkoutUrl
        ? `Checkout created with ${label} ${planId} fee`
        : "Payment recorded as pending.",
    });
  } catch (error) {
    console.error("[createPaymentLink]", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
