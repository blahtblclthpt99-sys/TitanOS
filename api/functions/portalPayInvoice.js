import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin, allowedOrigins } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { requirePortalSession } from "../_lib/requirePortalSession.js";
import { logError } from "../_lib/safeLog.js";

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
      .select("id,invoice_number,customer_id,created_by_id,status,total,balance_due")
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

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${origin}/portal?paid=1`);
    params.append("cancel_url", `${origin}/portal?paid=0`);
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][product_data][name]", invoice.invoice_number || "Invoice");
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
    params.append("line_items[0][quantity]", "1");
    params.append("metadata[invoice_id]", invoiceId);
    params.append("metadata[invoice_owner_id]", String(auth.session.created_by_id));
    params.append("metadata[customer_id]", String(auth.session.customer_id));
    params.append("metadata[source]", "portal");
    params.append("client_reference_id", invoiceId);

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
      logError("portalPayInvoice:stripe_checkout_failed", {
        message: session?.error?.message || "checkout failed",
      });
      return res.status(502).json({ error: "Could not create checkout session" });
    }

    await admin.from("portal_actions").insert({
      customer_id: auth.session.customer_id,
      action: "pay_invoice_checkout",
      entity_type: "invoice",
      entity_id: invoiceId,
      meta: { amount, checkout_id: session.id, owner_id: auth.session.created_by_id },
    });

    // Never mark paid here — only Stripe webhook / verified payment may close the invoice.
    return res.status(200).json({ url: session.url, checkout: true });
  } catch (error) {
    logError("portalPayInvoice", { message: error?.message || String(error) });
    captureApiException(error, { tags: { route: "portalPayInvoice" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
