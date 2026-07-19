import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

/** TitanOS fee on in-app transactions (0.76%). */
const PLATFORM_FEE_RATE = 0.0076;

function calcPlatformFee(amount) {
  const base = Math.round((Number(amount) || 0) * 100) / 100;
  const fee = Math.round(base * PLATFORM_FEE_RATE * 100) / 100;
  const total = Math.round((base + fee) * 100) / 100;
  return { base, fee, total };
}

/**
 * Creates a Stripe Checkout session when STRIPE_SECRET_KEY is configured.
 * Charges base amount + 0.76% TitanOS platform fee.
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

    const amount = Number(body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount required" });

    const { base, fee, total } = calcPlatformFee(amount);
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
        params.set("line_items[1][price_data][product_data][name]", "TitanOS platform fee (0.76%)");
        params.set("line_items[1][price_data][unit_amount]", String(Math.round(fee * 100)));
        params.set("line_items[1][quantity]", "1");
      }

      if (body.invoice_id) params.set("client_reference_id", body.invoice_id);
      params.set("metadata[platform_fee_rate]", String(PLATFORM_FEE_RATE));
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

    const feeNote = `Includes TitanOS platform fee 0.76% ($${fee.toFixed(2)}). Total charged $${total.toFixed(2)}.`;
    const insertPayload = {
      user_id: user.id,
      invoice_id: body.invoice_id || null,
      customer_name: body.customer_name || "",
      amount: total,
      base_amount: base,
      platform_fee: fee,
      platform_fee_rate: PLATFORM_FEE_RATE,
      amount_total: total,
      currency,
      provider,
      status,
      external_id: externalId,
      checkout_url: checkoutUrl,
      note: body.note
        ? `${body.note} · ${feeNote}`
        : checkoutUrl
          ? feeNote
          : `${feeNote} Add STRIPE_SECRET_KEY on Vercel to enable live Checkout links.`,
      created_by_id: user.id,
    };

    let { data: payment, error } = await admin
      .from("payments")
      .insert(insertPayload)
      .select("*")
      .single();

    // If migration 006 not applied yet, retry without new columns
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
        ? { ...retry.data, base_amount: base, platform_fee: fee, platform_fee_rate: PLATFORM_FEE_RATE, amount_total: total }
        : null;
      error = retry.error;
    }

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({
      payment,
      fee: { rate: PLATFORM_FEE_RATE, base, platform_fee: fee, amount_total: total },
      setupRequired: !checkoutUrl,
      message: checkoutUrl
        ? "Checkout session created with 0.76% platform fee"
        : "Payment recorded as pending. Set STRIPE_SECRET_KEY to enable live Stripe Checkout.",
    });
  } catch (error) {
    console.error("[createPaymentLink]", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
