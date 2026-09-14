import { logError } from "./safeLog.js";

export const AUTOPILOT_RESEND_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const RESEND_SUBJECT = "Payment reminder — overdue invoice";

export function canRetryAutopilotPending(queue, now = Date.now()) {
  if (queue?.status !== "pending" || !queue.created_at) return false;
  const created = new Date(queue.created_at).getTime();
  return Number.isFinite(created) && now - created < AUTOPILOT_RESEND_RETRY_WINDOW_MS;
}

export function autopilotQueueOutcome(row) {
  if (!row) return "missing";
  if (row.status === "sent") return "sent";
  if (row.status === "failed") return "failed";
  if (row.status === "skipped") return "skipped";
  return "pending";
}

export async function readAutopilotQueue(admin, { queueId, ownerId, deliveryKey } = {}) {
  let query = admin
    .from("follow_up_queue")
    .select("id,status,created_at,customer_email,message,provider_message_id,delivery_error_code");

  if (queueId) query = query.eq("id", queueId);
  if (ownerId) query = query.eq("created_by_id", ownerId);
  if (deliveryKey) query = query.eq("rule_id", deliveryKey);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

function providerErrorCode(body, status) {
  return String(body?.name || body?.error?.name || `http_${status}`);
}

async function markAmbiguous(admin, queueId, code) {
  try {
    await admin
      .from("follow_up_queue")
      .update({ delivery_error_code: code })
      .eq("id", queueId)
      .eq("status", "pending");
  } catch {
    // The queue status itself remains the source of truth and will be re-read.
  }
  return readAutopilotQueue(admin, { queueId });
}

export async function failAutopilotPending(admin, queueId, code) {
  const { data: failedRow, error } = await admin
    .from("follow_up_queue")
    .update({ status: "failed", delivery_error_code: code })
    .eq("id", queueId)
    .eq("status", "pending")
    .select("id,status,created_at,customer_email,message,provider_message_id,delivery_error_code")
    .maybeSingle();
  if (error) throw error;
  if (failedRow) return failedRow;
  return readAutopilotQueue(admin, { queueId });
}

export async function deliverAutopilotQueue({
  admin,
  queue,
  resendKey,
  deliveryKey,
  route,
  context = {},
}) {
  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
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
  } catch (error) {
    const current = await markAmbiguous(admin, queue.id, "network_ambiguous");
    const reconciled = autopilotQueueOutcome(current);
    logError(`${route}:resend_network`, error, { ...context, reconciled });
    return {
      outcome: reconciled === "missing" ? "pending" : reconciled,
      errorCode: "network_ambiguous",
      row: current,
    };
  }

  const body = await response.json().catch(() => ({}));

  if (response.ok) {
    const providerMessageId = String(body?.id || "").trim() || null;
    const { data: sentRow, error: sentError } = await admin
      .from("follow_up_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
        delivery_error_code: providerMessageId ? null : "provider_receipt_missing",
      })
      .eq("id", queue.id)
      .eq("status", "pending")
      .select("id,status,created_at,customer_email,message,provider_message_id,delivery_error_code")
      .maybeSingle();

    if (sentError || !sentRow) {
      const current = await readAutopilotQueue(admin, { queueId: queue.id });
      const reconciled = autopilotQueueOutcome(current);
      if (reconciled !== "sent") {
        await markAmbiguous(admin, queue.id, "provider_accepted_receipt_persist_ambiguous");
      }
      logError(
        `${route}:receipt_persist`,
        sentError || new Error("Provider accepted email but queue receipt update lost its lease"),
        { ...context, providerMessageId, reconciled }
      );
      return {
        outcome: reconciled === "missing" ? "pending" : reconciled,
        errorCode: reconciled === "sent" ? null : "provider_accepted_receipt_persist_ambiguous",
        providerMessageId: current?.provider_message_id || providerMessageId,
        row: current,
      };
    }

    return { outcome: "sent", providerMessageId, row: sentRow };
  }

  const code = providerErrorCode(body, response.status);
  if (response.status === 409 && code === "concurrent_idempotent_requests") {
    const current = await markAmbiguous(admin, queue.id, code);
    const reconciled = autopilotQueueOutcome(current);
    logError(
      `${route}:resend_retryable`,
      new Error("Resend idempotent request is still in progress"),
      { ...context, status: response.status, code, reconciled }
    );
    return {
      outcome: reconciled === "missing" ? "pending" : reconciled,
      errorCode: code,
      row: current,
    };
  }

  const current = await failAutopilotPending(admin, queue.id, code);
  const reconciled = autopilotQueueOutcome(current);
  logError(
    `${route}:resend`,
    new Error(`Resend rejected Autopilot delivery (${code})`),
    { ...context, status: response.status, code, reconciled }
  );
  return {
    outcome: reconciled === "missing" ? "failed" : reconciled,
    errorCode: code,
    row: current,
  };
}
