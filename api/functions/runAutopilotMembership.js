import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

const MAX_INVOICES = 10;
const periodKey = () => `${new Date().toISOString().slice(0, 7)}-01`;

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 4, windowMs: 60_000, key: "runAutopilotMembership" }))) return;
  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { data: profile } = await auth.admin.from("profiles")
      .select("plan_tier,paying_subscriber").eq("id", auth.user.id).maybeSingle();
    const plan = String(profile?.plan_tier || "").toLowerCase();
    const isAdmin = auth.user.app_metadata?.role === "admin";
    const entitled = isAdmin || (profile?.paying_subscriber === true && ["worker_premium", "pro", "business"].includes(plan));
    if (!entitled) return res.status(402).json({ error: "A paid Pro or Business membership is required." });

    const body = readJson(req);
    const invoiceIds = [...new Set(Array.isArray(body.invoice_ids) ? body.invoice_ids.map(String) : [])].slice(0, MAX_INVOICES);
    if (!invoiceIds.length) return res.status(400).json({ error: "Select at least one overdue invoice" });
    const { data: invoices, error: invoiceError } = await auth.admin.from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
      .in("id", invoiceIds).eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;
    const today = new Date().toISOString().slice(0, 10);
    if ((invoices || []).length !== invoiceIds.length || !invoices.every((invoice) =>
      invoice.customer_email && invoice.status !== "paid" && invoice.due_date && invoice.due_date < today && Number(invoice.balance_due ?? invoice.total) > 0
    )) return res.status(400).json({ error: "Every selection must be overdue, unpaid, and have a customer email" });

    const { data: claim, error: claimError } = await auth.admin.from("autopilot_membership_claims").insert({
      user_id: auth.user.id, period_key: periodKey(), invoice_ids: invoiceIds, status: "running",
    }).select("id").single();
    if (claimError?.code === "23505") return res.status(409).json({ error: "This month's included recovery sprint has already been used." });
    if (claimError) throw claimError;
    const resendKey = process.env.RESEND_API_KEY;
    let prepared = 0;
    let sent = 0;
    let failed = 0;
    for (const invoice of invoices) {
      const balance = Number(invoice.balance_due ?? invoice.total ?? 0).toFixed(2);
      const message = `Hi ${invoice.customer_name || "there"},\n\nThis is a friendly reminder that invoice ${invoice.invoice_number || invoice.id} for $${balance} was due ${invoice.due_date}. Please contact us if you have already paid or need help with payment.\n\nThank you.`;
      const { data: queue, error: queueError } = await auth.admin.from("follow_up_queue").insert({
        created_by_id: auth.user.id, user_id: auth.user.id, customer_name: invoice.customer_name || "", customer_email: invoice.customer_email,
        scheduled_for: new Date().toISOString(), status: "pending", channel: "email", message, rule_id: "autopilot_membership",
      }).select("id").single();
      if (queueError) { failed += 1; continue; }
      prepared += 1;
      if (!resendKey) continue;
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({
        from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>", to: [invoice.customer_email], subject: `Payment reminder — invoice ${invoice.invoice_number || "due"}`, text: message,
      }) });
      if (response.ok) { sent += 1; await auth.admin.from("follow_up_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", queue.id); }
      else { failed += 1; await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", queue.id); logError("runAutopilotMembership:resend", { claimId: claim.id, invoiceId: invoice.id, status: response.status }); }
    }
    await auth.admin.from("autopilot_membership_claims").update({ status: prepared ? "completed" : "failed", prepared_count: prepared, sent_count: sent, failed_count: failed, updated_at: new Date().toISOString() }).eq("id", claim.id);
    return res.status(200).json({ success: prepared > 0, prepared, sent, failed, delivery_mode: resendKey ? "email" : "review_queue", period: periodKey() });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, { route: "runAutopilotMembership", category: "automation", publicMessage: "The included recovery sprint could not finish", publicCode: "AUTOPILOT_MEMBERSHIP_FAILED" });
  }
}
