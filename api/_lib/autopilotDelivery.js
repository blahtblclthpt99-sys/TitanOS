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

async function markAmbiguous(admin, queueId, code) {
  try {
    await admin
      .from("follow_up_queue")
      .update({ delivery_error_code: code })
      .eq("id", queueId)
      .eq("status", "pending");
  } catch {
    // The queue status itself remains pending, which is the fail-closed state.
  }
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
    // The provider may have accepted the message even if the response was lost.
    await markAmbiguous(admin, queue.id, "network_ambiguous");
    logError(`${route}:resend_network`, error, context);
    return { outcome: "pending", errorCode: "network_ambiguous" };
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
      .select("id,status")
      .maybeSingle();

    if (sentError || !sentRow) {
      await markAmbiguous(admin, queue.id, "provider_accepted_receipt_persist_ambiguous");
      logError(
        `${route}:receipt_persist`,
        sentError || new Error("Provider accepted email but queue receipt update lost its lease"),
        { ...context, providerMessageId }
      );
      return {
        outcome: "pending",
        errorCode: "provider_accepted_receipt_persist_ambiguous",
        providerMessageId,
      };
    }

    return { outcome: "sent", providerMessageId };
  }

  const code = providerErrorCode(body, response.status);
  if (response.status === 409 && code === "concurrent_idempotent_requests") {
    await markAmbiguous(admin, queue.id, code);
    logError(
      `${route}:resend_retryable`,
      new Error("Resend idempotent request is still in progress"),
      { ...context, status: response.status, code }
    );
    return { outcome: "pending", errorCode: code };
  }

  await failAutopilotPending(admin, queue.id, code);
  logError(
    `${route}:resend`,
    new Error(`Resend rejected Autopilot delivery (${code})`),
    { ...context, status: response.status, code }
  );
  return { outcome: "failed", errorCode: code };
}
