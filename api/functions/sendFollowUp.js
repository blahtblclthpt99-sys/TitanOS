import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

function isAutopilotQueueRow(row) {
  return String(row?.rule_id || "").startsWith("autopilot_run:");
}

function isOwnedQueueRow(row, userId) {
  const owner = String(userId || "");
  if (!owner) return false;
  return String(row?.user_id || "") === owner || String(row?.created_by_id || "") === owner;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, {
    limit: 10,
    windowMs: 60_000,
    key: "sendFollowUp",
    requireDurable: true,
  }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { queue_id: queueId, to, subject, body } = readJson(req);
    if (!body && !queueId) return res.status(400).json({ error: "body or queue_id is required" });

    const admin = getSupabaseAdmin();
    let row = null;
    if (queueId) {
      const { data, error: rowError } = await admin.from("follow_up_queue").select("*").eq("id", queueId).maybeSingle();
      if (rowError) throw rowError;
      row = data;
      if (!row) return res.status(404).json({ error: "Follow-up not found" });
      if (!isOwnedQueueRow(row, auth.user.id)) {
        return res.status(403).json({ error: "Not allowed" });
      }
      if (isAutopilotQueueRow(row)) {
        return res.status(409).json({
          error: "Autopilot recovery records are managed by Titan Autopilot. Retry them from the Recovery Command Center so duplicate protection remains intact.",
          code: "AUTOPILOT_QUEUE_PROTECTED",
        });
      }
      if (row.status === "sent") {
        return res.status(200).json({
          success: true,
          duplicate: true,
          emailed: row.channel === "email",
          user_id: auth.user.id,
          message: "Follow-up was already sent",
        });
      }
      if (row.status !== "pending") {
        return res.status(409).json({
          error: "Only pending follow-ups can be sent",
          code: "FOLLOW_UP_NOT_PENDING",
        });
      }
    }

    const emailTo = row?.customer_email || to;
    if (!queueId && to && to.toLowerCase() !== String(auth.user.email || "").toLowerCase()) {
      return res.status(403).json({
        error: "Without a follow-up queue item, you may only email your own account for testing.",
      });
    }
    const message = body || row?.message || "";
    const emailSubject = subject || "Follow-up from TitanOS";

    let emailed = false;
    let providerMessageId = null;
    if (emailTo) {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        logError("sendFollowUp:delivery_unconfigured", new Error("Email delivery not configured"), {
          user: auth.user.id,
          hasRecipient: Boolean(emailTo),
          subjectLength: String(emailSubject || "").length,
        });
        return res.status(503).json({ error: "Email delivery is not configured", stub: true });
      }

      const headers = {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      };
      if (queueId) headers["Idempotency-Key"] = `followup_queue_${queueId}`;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>",
          to: [emailTo],
          subject: emailSubject,
          text: message,
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        logError("sendFollowUp:resend", new Error("Resend rejected generic follow-up"), {
          status: response.status,
          detail: err.slice(0, 180),
        });
        return res.status(502).json({ error: "Failed to send email" });
      }
      const provider = await response.json().catch(() => null);
      providerMessageId = provider?.id ? String(provider.id) : null;
      emailed = true;
    }

    if (queueId) {
      let updateQuery = admin
        .from("follow_up_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          channel: emailed ? "email" : row?.channel || "in_app",
          provider_message_id: providerMessageId,
          delivery_error_code: null,
        })
        .eq("id", queueId)
        .eq("status", "pending")
        .not("rule_id", "like", "autopilot_run:%");
      if (row?.created_by_id) updateQuery = updateQuery.eq("created_by_id", row.created_by_id);
      if (row?.user_id) updateQuery = updateQuery.eq("user_id", row.user_id);

      const { data: updated, error: updateError } = await updateQuery.select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) {
        const { data: current, error: currentError } = await admin
          .from("follow_up_queue")
          .select("id,status,channel")
          .eq("id", queueId)
          .maybeSingle();
        if (currentError) throw currentError;
        if (current?.status === "sent") {
          return res.status(200).json({
            success: true,
            duplicate: true,
            emailed: current.channel === "email",
            user_id: auth.user.id,
            message: "Follow-up was already sent",
          });
        }
        return res.status(409).json({ error: "Follow-up changed before it could be marked sent" });
      }
    }

    return res.status(200).json({
      success: true,
      emailed,
      user_id: auth.user.id,
      message: emailed ? "Follow-up emailed" : "Marked sent (no customer email on file)",
    });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "sendFollowUp",
      category: "email",
      publicMessage: "Follow-up could not be sent",
      publicCode: "FOLLOW_UP_FAILED",
    });
  }
}
