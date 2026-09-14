import { logError } from "./safeLog.js";

export const AUTOPILOT_RESEND_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const RESEND_SUBJECT = "Payment reminder — overdue invoice";

export function canRetryAutopilotPending(queue, now = Date.now()) {
  if (queue?.status !== "pending" || !queue.created_at) return false;
  const created = new Date(queue.created_at).getTime();
  return Number.isFinite(created) && now - created < AUTOPILOT_RESEND_RETRY_WINDOW_MS;
}

function providerErrorCode(body, status) {
  return String(body?.name || body?.error?.name || `http_${status}`);
}

export async function failAutopilotPending(admin, queueId, code) {
  const { error } = await admin
    .from("follow_up_queue")
    .update({ status: "failed", delivery_error_code: code })
    .eq("id", queueId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function deliverAutopilotQueue({
  admin,
  queue,
  resendKey,
  deliveryKey,
  route,
  context = {},
}) {
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

    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      const providerMessageId = String(body?.id || "").trim() || null;
      const { error: sentError } = await admin
        .from("follow_up_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: providerMessageId,
          delivery_error_code: providerMessageId ? null : "provider_receipt_missing",
        })
        .eq("id", queue.id)
        .eq("status", "pending");
      if (sentError) throw sentError;
      return { outcome: "sent", providerMessageId };
    }

    const code = providerErrorCode(body, response.status);
    if (response.status === 409 && code === "concurrent_idempotent_requests") {
      await admin
        .from("follow_up_queue")
        .update({ delivery_error_code: code })
        .eq("id", queue.id)
        .eq("status", "pending");
      logError(`${route}:resend_retryable`, { ...context, status: response.status, code });
      return { outcome: "pending", errorCode: code };
    }

    await failAutopilotPending(admin, queue.id, code);
    logError(`${route}:resend`, { ...context, status: response.status, code });
    return { outcome: "failed", errorCode: code };
  } catch (error) {
    // The provider may have accepted the message even if the response was lost.
    // Preserve pending state and retry with the same provider idempotency key.
    try {
      await admin
        .from("follow_up_queue")
        .update({ delivery_error_code: "network_ambiguous" })
        .eq("id", queue.id)
        .eq("status", "pending");
    } catch {
      // Do not convert an ambiguous provider outcome into a local hard failure.
    }
    logError(`${route}:resend_network`, { ...context, error: error?.message });
    return { outcome: "pending", errorCode: "network_ambiguous" };
  }
}
