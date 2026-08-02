import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

function parseOrder(note = "") {
  if (!String(note).startsWith("AUTOPILOT:")) return null;
  try { return JSON.parse(String(note).slice(10)); } catch { return null; }
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 5, windowMs: 60_000, key: "runAutopilotOrder" }))) return;
  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { order_id: orderId } = readJson(req);
    if (!orderId) return res.status(400).json({ error: "order_id is required" });
    const { data: payment } = await auth.admin.from("payments").select("id,user_id,status,note").eq("id", orderId).eq("user_id", auth.user.id).maybeSingle();
    const order = parseOrder(payment?.note);
    if (!payment || !order || order.type !== "invoice_recovery_sprint") return res.status(404).json({ error: "Autopilot order not found" });
    if (payment.status !== "succeeded") return res.status(409).json({ error: "Payment is still processing. Try again in a moment.", payment_status: payment.status });
    if (order.state === "completed") return res.status(200).json({ success: true, duplicate: true, sent: order.sent || 0, failed: order.failed || 0 });
    if (order.state === "running") return res.status(409).json({ error: "This recovery sprint is already running." });

    // Atomic claim: only one request can move this exact order note into running state.
    const running = { ...order, state: "running", started_at: new Date().toISOString() };
    const { data: claimed, error: claimError } = await auth.admin.from("payments")
      .update({ note: `AUTOPILOT:${JSON.stringify(running)}`, updated_at: new Date().toISOString() })
      .eq("id", payment.id).eq("status", "succeeded").eq("note", payment.note).select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return res.status(409).json({ error: "This recovery sprint has already been claimed." });

    const { data: invoices, error: invoiceError } = await auth.admin.from("invoices")
      .select("id,invoice_number,customer_name,customer_email,balance_due,total,due_date,created_by_id")
      .in("id", order.invoice_ids || []).eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return res.status(503).json({ error: "Email delivery is not configured" });
    let sent = 0;
    let failed = 0;
    for (const invoice of invoices || []) {
      const balance = Number(invoice.balance_due ?? invoice.total ?? 0).toFixed(2);
      const message = `Hi ${invoice.customer_name || "there"},\n\nThis is a friendly reminder that invoice ${invoice.invoice_number || invoice.id} for $${balance} was due ${invoice.due_date}. Please contact us if you have already paid or need help with payment.\n\nThank you.`;
      const { data: queue, error: queueError } = await auth.admin.from("follow_up_queue").insert({
        created_by_id: auth.user.id, user_id: auth.user.id, customer_id: null, customer_name: invoice.customer_name || "",
        customer_email: invoice.customer_email, job_id: null, rule_id: null, scheduled_for: new Date().toISOString(), status: "pending", channel: "email", message,
      }).select("id").single();
      if (queueError) { failed += 1; continue; }
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
        from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>", to: [invoice.customer_email], subject: `Payment reminder — invoice ${invoice.invoice_number || "due"}`, text: message,
      }) });
      if (response.ok) {
        sent += 1;
        await auth.admin.from("follow_up_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", queue.id);
      } else {
        failed += 1;
        await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", queue.id);
        logError("runAutopilotOrder:resend", { orderId, invoiceId: invoice.id, status: response.status });
      }
    }
    const completed = { ...running, state: "completed", completed_at: new Date().toISOString(), sent, failed };
    await auth.admin.from("payments").update({ note: `AUTOPILOT:${JSON.stringify(completed)}`, updated_at: new Date().toISOString() }).eq("id", payment.id).eq("status", "succeeded");
    return res.status(200).json({ success: true, sent, failed });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, { route: "runAutopilotOrder", category: "automation", publicMessage: "The recovery sprint could not finish", publicCode: "AUTOPILOT_RUN_FAILED" });
  }
}
