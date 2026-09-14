import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

const STALE_RUN_MS = 15 * 60 * 1000;
const RESEND_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const RESEND_SUBJECT = "Payment reminder — overdue invoice";

function parseOrder(note = "") {
  if (!String(note).startsWith("AUTOPILOT:")) return null;
  try { return JSON.parse(String(note).slice(10)); } catch { return null; }
}

function isStillEligible(invoice, today) {
  return Boolean(
    invoice?.customer_email &&
    invoice.status !== "paid" &&
    invoice.due_date &&
    invoice.due_date < today &&
    Number(invoice.balance_due ?? invoice.total) > 0
  );
}

function isFreshRun(order) {
  if (order?.state !== "running" || !order.started_at) return false;
  const started = new Date(order.started_at).getTime();
  return Number.isFinite(started) && Date.now() - started < STALE_RUN_MS;
}

function pendingCanRetry(queue) {
  if (queue?.status !== "pending" || !queue.created_at) return false;
  const created = new Date(queue.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created < RESEND_RETRY_WINDOW_MS;
}

async function deliverQueuedReminder({ admin, queue, resendKey, deliveryKey, logContext }) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": deliveryKey,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>",
        to: [queue.customer_email],
        subject: RESEND_SUBJECT,
        text: queue.message,
      }),
    });

    if (response.ok) {
      const { error: sentError } = await admin
        .from("follow_up_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", queue.id)
        .eq("status", "pending");
      if (sentError) throw sentError;
      return "sent";
    }

    // A 409 can mean another request using the same Resend idempotency key is
    // still in flight. Leave the row pending so a later retry can safely ask
    // Resend for the same operation again inside its idempotency window.
    if (response.status === 409) {
      logError("runAutopilotOrder:resend_retryable", { ...logContext, status: response.status });
      return "pending";
    }

    await admin.from("follow_up_queue").update({ status: "failed" }).eq("id", queue.id).eq("status", "pending");
    logError("runAutopilotOrder:resend", { ...logContext, status: response.status });
    return "failed";
  } catch (error) {
    // Network failures are ambiguous: Resend may have accepted the email even
    // if this process never received the response. Keep the row pending and
    // retry with the same provider idempotency key instead of risking a duplicate.
    logError("runAutopilotOrder:resend_network", { ...logContext, error: error?.message });
    return "pending";
  }
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

    const { data: payment, error: paymentError } = await auth.admin
      .from("payments")
      .select("id,user_id,status,note")
      .eq("id", orderId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (paymentError) throw paymentError;

    const order = parseOrder(payment?.note);
    if (!payment || !order || order.type !== "invoice_recovery_sprint") {
      return res.status(404).json({ error: "Autopilot order not found" });
    }
    if (payment.status !== "succeeded") {
      return res.status(409).json({ error: "Payment is still processing. Try again in a moment.", payment_status: payment.status });
    }
    if (order.state === "completed") {
      return res.status(200).json({
        success: true,
        duplicate: true,
        sent: order.sent || 0,
        failed: order.failed || 0,
        skipped: order.skipped || 0,
        pending: 0,
      });
    }
    if (isFreshRun(order)) {
      return res.status(409).json({ error: "This recovery sprint is already running." });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return res.status(503).json({ error: "Email delivery is not configured" });

    const running = {
      ...order,
      state: "running",
      started_at: new Date().toISOString(),
      recovered_from_stale_run: order.state === "running" || order.state === "retryable" || undefined,
    };
    const runningNote = `AUTOPILOT:${JSON.stringify(running)}`;
    const { data: claimed, error: claimError } = await auth.admin
      .from("payments")
      .update({ note: runningNote, updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "succeeded")
      .eq("note", payment.note)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return res.status(409).json({ error: "This recovery sprint has already been claimed." });

    const { data: invoices, error: invoiceError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
      .in("id", order.invoice_ids || [])
      .eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;

    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;

    for (const invoice of invoices || []) {
      const deliveryKey = `autopilot_run:order:${payment.id}:${invoice.id}`;

      const { data: prior, error: priorError } = await auth.admin
        .from("follow_up_queue")
        .select("id,status,created_at,customer_email,message")
        .eq("created_by_id", auth.user.id)
        .eq("rule_id", deliveryKey)
        .maybeSingle();
      if (priorError) throw priorError;

      if (prior) {
        if (prior.status === "sent") {
          sent += 1;
          continue;
        }
        if (prior.status === "failed") {
          failed += 1;
          continue;
        }
        if (prior.status === "skipped") {
          skipped += 1;
          continue;
        }

        // Before retrying an ambiguous pending send, stop if the invoice is no
        // longer eligible. We cannot prove whether the first network attempt was
        // delivered, so record it as failed/unconfirmed rather than claim skipped.
        const { data: freshForRetry, error: retryReadError } = await auth.admin
          .from("invoices")
          .select("id,customer_email,status,balance_due,total,due_date,created_by_id")
          .eq("id", invoice.id)
          .eq("created_by_id", auth.user.id)
          .maybeSingle();
        if (retryReadError) throw retryReadError;
        if (!isStillEligible(freshForRetry, today)) {
          await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", prior.id).eq("status", "pending");
          failed += 1;
          logError("runAutopilotOrder:pending_no_longer_eligible", { orderId, invoiceId: invoice.id });
          continue;
        }

        if (!pendingCanRetry(prior)) {
          await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", prior.id).eq("status", "pending");
          failed += 1;
          logError("runAutopilotOrder:pending_retry_window_expired", { orderId, invoiceId: invoice.id });
          continue;
        }

        const outcome = await deliverQueuedReminder({
          admin: auth.admin,
          queue: prior,
          resendKey,
          deliveryKey,
          logContext: { orderId, invoiceId: invoice.id },
        });
        if (outcome === "sent") sent += 1;
        else if (outcome === "failed") failed += 1;
        else pending += 1;
        continue;
      }

      // Re-read immediately before creating the delivery so invoices paid or
      // edited after approval are stopped before any provider request is made.
      const { data: freshInvoice, error: freshError } = await auth.admin
        .from("invoices")
        .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
        .eq("id", invoice.id)
        .eq("created_by_id", auth.user.id)
        .maybeSingle();
      if (freshError) throw freshError;

      if (!isStillEligible(freshInvoice, today)) {
        skipped += 1;
        const message = `Skipped invoice ${invoice.invoice_number || invoice.id}: it is no longer an eligible overdue balance.`;
        const { error: skipError } = await auth.admin.from("follow_up_queue").insert({
          created_by_id: auth.user.id,
          user_id: auth.user.id,
          customer_id: null,
          customer_name: invoice.customer_name || "",
          customer_email: invoice.customer_email || null,
          job_id: null,
          rule_id: deliveryKey,
          scheduled_for: new Date().toISOString(),
          status: "skipped",
          channel: "email",
          message,
        });
        if (skipError && skipError.code !== "23505") throw skipError;
        continue;
      }

      const balance = Number(freshInvoice.balance_due ?? freshInvoice.total ?? 0).toFixed(2);
      const message = `Hi ${freshInvoice.customer_name || "there"},\n\nThis is a friendly reminder that invoice ${freshInvoice.invoice_number || freshInvoice.id} for $${balance} was due ${freshInvoice.due_date}. Please contact us if you have already paid or need help with payment.\n\nThank you.`;
      const { data: queue, error: queueError } = await auth.admin.from("follow_up_queue").insert({
        created_by_id: auth.user.id,
        user_id: auth.user.id,
        customer_id: null,
        customer_name: freshInvoice.customer_name || "",
        customer_email: freshInvoice.customer_email,
        job_id: null,
        rule_id: deliveryKey,
        scheduled_for: new Date().toISOString(),
        status: "pending",
        channel: "email",
        message,
      }).select("id,status,created_at,customer_email,message").single();

      if (queueError) {
        if (queueError.code === "23505") {
          pending += 1;
          continue;
        }
        failed += 1;
        logError("runAutopilotOrder:queue", { orderId, invoiceId: invoice.id, error: queueError.message });
        continue;
      }

      const outcome = await deliverQueuedReminder({
        admin: auth.admin,
        queue,
        resendKey,
        deliveryKey,
        logContext: { orderId, invoiceId: invoice.id },
      });
      if (outcome === "sent") sent += 1;
      else if (outcome === "failed") failed += 1;
      else pending += 1;
    }

    const knownInvoiceIds = new Set((invoices || []).map((invoice) => String(invoice.id)));
    skipped += (order.invoice_ids || []).filter((id) => !knownInvoiceIds.has(String(id))).length;

    const finished = {
      ...running,
      state: pending > 0 ? "retryable" : "completed",
      completed_at: pending > 0 ? undefined : new Date().toISOString(),
      retryable_at: pending > 0 ? new Date().toISOString() : undefined,
      sent,
      failed,
      skipped,
      pending,
    };
    const { data: completedClaim, error: completeError } = await auth.admin
      .from("payments")
      .update({ note: `AUTOPILOT:${JSON.stringify(finished)}`, updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "succeeded")
      .eq("note", runningNote)
      .select("id")
      .maybeSingle();
    if (completeError) throw completeError;
    if (!completedClaim) {
      return res.status(409).json({ error: "This sprint lease changed while it was finishing. Retry to reconcile the recorded deliveries." });
    }

    return res.status(pending > 0 ? 202 : 200).json({
      success: pending === 0,
      retryable: pending > 0,
      sent,
      failed,
      skipped,
      pending,
      error: pending > 0 ? "One or more deliveries are awaiting safe retry." : undefined,
    });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "runAutopilotOrder",
      category: "automation",
      publicMessage: "The recovery sprint could not finish",
      publicCode: "AUTOPILOT_RUN_FAILED",
    });
  }
}
