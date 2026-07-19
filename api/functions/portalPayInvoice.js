import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

async function requirePortalSession(admin, token) {
  if (!token || typeof token !== "string") return { error: "Missing session token", status: 400 };
  const { data: sessions } = await admin.from("portal_sessions").select("*").eq("token", token).limit(1);
  const session = sessions?.[0];
  if (!session?.verified) return { error: "Invalid or expired session", status: 401 };
  if (!session.token_expires_at || new Date(session.token_expires_at) < new Date()) {
    return { error: "Session expired. Please sign in again.", status: 401 };
  }
  return { session };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const admin = getSupabaseAdmin();
    const { token, invoice_id: invoiceId } = readJson(req);
    const auth = await requirePortalSession(admin, token);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (!invoiceId) return res.status(400).json({ error: "invoice_id is required" });

    const { data: invoice, error: findErr } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("customer_id", auth.session.customer_id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const amount = Number(invoice.balance_due || invoice.total || 0);
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const origin = process.env.APP_ORIGIN || "https://titanos-web.vercel.app";

    if (!stripeKey) {
      return res.status(503).json({
        error: "Payments are not configured yet. Ask your provider to enable Stripe Checkout.",
        setupRequired: true,
      });
    }
    if (!(amount > 0)) {
      return res.status(400).json({ error: "Invoice has no balance due" });
    }

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${origin}/portal?paid=1`);
    params.append("cancel_url", `${origin}/portal?paid=0`);
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][product_data][name]", invoice.invoice_number || "Invoice");
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
    params.append("line_items[0][quantity]", "1");
    params.append("metadata[invoice_id]", invoiceId);
    params.append("metadata[customer_id]", auth.session.customer_id);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await response.json();
    if (!response.ok) {
      console.error("Stripe portal pay error:", session);
      return res.status(502).json({ error: "Could not create checkout session" });
    }

    await admin.from("portal_actions").insert({
      customer_id: auth.session.customer_id,
      action: "pay_invoice_checkout",
      entity_type: "invoice",
      entity_id: invoiceId,
      meta: { amount, checkout_id: session.id },
    });

    // Never mark paid here — only Stripe webhook / verified payment may close the invoice.
    return res.status(200).json({ url: session.url, checkout: true });
  } catch (error) {
    console.error("portalPayInvoice error:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
