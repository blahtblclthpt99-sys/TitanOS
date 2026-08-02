import Stripe from "stripe";
import { applyCors, handleOptions, resolveAppOrigin } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";

const SPRINT_PRICE_CENTS = 900;
const MAX_INVOICES = 10;

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 8, windowMs: 60_000, key: "createAutopilotOrder" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Autopilot checkout is not configured" });

  try {
    const body = readJson(req);
    const invoiceIds = [...new Set(Array.isArray(body.invoice_ids) ? body.invoice_ids.map(String) : [])].slice(0, MAX_INVOICES);
    if (!invoiceIds.length) return res.status(400).json({ error: "Select at least one overdue invoice" });

    const { data: invoices, error: invoiceError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
      .in("id", invoiceIds)
      .eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;
    if ((invoices || []).length !== invoiceIds.length) return res.status(403).json({ error: "One or more invoices are unavailable" });

    const today = new Date().toISOString().slice(0, 10);
    const eligible = invoices.every((invoice) =>
      invoice.customer_email && invoice.status !== "paid" && invoice.due_date && invoice.due_date < today && Number(invoice.balance_due ?? invoice.total) > 0
    );
    if (!eligible) return res.status(400).json({ error: "Every selection must be overdue, unpaid, and have a customer email" });

    const orderData = {
      type: "invoice_recovery_sprint",
      state: "awaiting_payment",
      invoice_ids: invoiceIds,
      approved_at: new Date().toISOString(),
      price_cents: SPRINT_PRICE_CENTS,
    };
    const { data: payment, error: paymentError } = await auth.admin.from("payments").insert({
      created_by_id: auth.user.id,
      user_id: auth.user.id,
      customer_name: auth.user.email || "TitanOS user",
      amount: SPRINT_PRICE_CENTS / 100,
      currency: "usd",
      provider: "stripe",
      status: "pending",
      note: `AUTOPILOT:${JSON.stringify(orderData)}`,
    }).select("*").single();
    if (paymentError) throw paymentError;

    const origin = resolveAppOrigin(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const configuredPriceId = String(process.env.STRIPE_AUTOPILOT_PRICE_ID || "").trim();
    const lineItem = configuredPriceId
      ? { quantity: 1, price: configuredPriceId }
      : {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: SPRINT_PRICE_CENTS,
            product_data: {
              name: "Titan Autopilot — Invoice Recovery Sprint",
              description: `Approved follow-up for ${invoiceIds.length} overdue invoice${invoiceIds.length === 1 ? "" : "s"} (up to 10).`,
            },
          },
        };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: auth.user.email || undefined,
      line_items: [lineItem],
      metadata: { payment_id: payment.id, user_id: auth.user.id, task_type: "invoice_recovery_sprint" },
      success_url: `${origin}/autopilot?order=${encodeURIComponent(payment.id)}&checkout=success`,
      cancel_url: `${origin}/autopilot?order=${encodeURIComponent(payment.id)}&checkout=canceled`,
    }, { idempotencyKey: `autopilot_${payment.id}` });

    await auth.admin.from("payments").update({ external_id: session.id, checkout_url: session.url }).eq("id", payment.id);
    return res.status(200).json({ order_id: payment.id, checkout_url: session.url, amount: 9, invoice_count: invoiceIds.length });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, { route: "createAutopilotOrder", category: "payments", publicMessage: "Autopilot checkout could not be created", publicCode: "AUTOPILOT_CHECKOUT_FAILED" });
  }
}
