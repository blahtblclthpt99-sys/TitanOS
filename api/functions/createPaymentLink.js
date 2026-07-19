import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

/**
 * Creates a Stripe Checkout session when STRIPE_SECRET_KEY is configured.
 * Otherwise returns a pending payment record with setup instructions.
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
      params.set("line_items[0][price_data][currency]", currency);
      params.set("line_items[0][price_data][product_data][name]", body.customer_name ? `Invoice for ${body.customer_name}` : "TitanOS Payment");
      params.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
      params.set("line_items[0][quantity]", "1");
      if (body.invoice_id) params.set("client_reference_id", body.invoice_id);

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

    const { data: payment, error } = await admin
      .from("payments")
      .insert({
        user_id: user.id,
        invoice_id: body.invoice_id || null,
        customer_name: body.customer_name || "",
        amount,
        currency,
        provider,
        status,
        external_id: externalId,
        checkout_url: checkoutUrl,
        note: body.note || (checkoutUrl ? "" : "Add STRIPE_SECRET_KEY on Vercel to enable live Checkout links."),
        created_by_id: user.id,
      })
      .select("*")
      .single();

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({
      payment,
      setupRequired: !checkoutUrl,
      message: checkoutUrl
        ? "Checkout session created"
        : "Payment recorded as pending. Set STRIPE_SECRET_KEY to enable live Stripe Checkout.",
    });
  } catch (error) {
    console.error("[createPaymentLink]", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
