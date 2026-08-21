import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { loadOwnedSupportCase, writeSupportAuditBestEffort } from "../_lib/support.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, {
    limit: 8,
    windowMs: 10 * 60_000,
    key: "supportEscalate",
    requireDurable: true,
  }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const supportCase = await loadOwnedSupportCase(auth.admin, auth.user.id, body.case_id);
    if (!supportCase) return res.status(404).json({ error: "Support case not found." });
    if (["RESOLVED", "CLOSED"].includes(supportCase.status)) {
      return res.status(409).json({ error: "Resolve state must be reopened before human escalation." });
    }
    if (["HUMAN_AGENT", "ENGINEERING"].includes(supportCase.status)) {
      return res.status(200).json({ success: true, status: supportCase.status, already_escalated: true });
    }

    const { data: systemMessage, error: messageError } = await auth.admin
      .from("support_messages")
      .insert({
        case_id: supportCase.id,
        sender_kind: "system",
        body: "Human support requested. Your existing conversation and authorized diagnostics stay attached to this case so you do not need to start over.",
        metadata: { event: "human_escalation_requested" },
      })
      .select("id,created_at")
      .single();

    if (messageError?.code === "23505") {
      const { data: refreshed } = await auth.admin.from("support_cases").select("status").eq("id", supportCase.id).maybeSingle();
      return res.status(200).json({ success: true, status: refreshed?.status || "HUMAN_AGENT", already_escalated: true });
    }
    if (messageError?.code === "23514") return res.status(409).json({ error: "This case changed state. Refresh it before requesting human support." });
    if (messageError) throw messageError;

    const { error: eventError } = await auth.admin.from("support_case_events").insert({
      case_id: supportCase.id,
      actor_user_id: auth.user.id,
      event_type: "human_escalation_requested",
      from_status: supportCase.status,
      to_status: "HUMAN_AGENT",
      details: { requested_by: "customer" },
    });
    if (eventError) logError("supportEscalate:event", eventError, { caseId: supportCase.id });

    await writeSupportAuditBestEffort(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "human_escalation_requested",
      targetType: "support_message",
      targetId: systemMessage.id,
      metadata: { from_status: supportCase.status, to_status: "HUMAN_AGENT" },
    }, "supportEscalate:audit");

    return res.status(200).json({ success: true, status: "HUMAN_AGENT" });
  } catch (error) {
    logError("supportEscalate", error);
    captureApiException(error, { tags: { route: "supportEscalate" } });
    return res.status(500).json({ error: "Support case could not be escalated." });
  }
}
