import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { cleanSupportMessage, loadAssignedSupportCase, supportRole, writeSupportAuditBestEffort } from "../_lib/support.js";

const ALLOWED_NEXT_STATUS = new Set(["NEEDS_USER", "HUMAN_AGENT", "ENGINEERING", "RESOLVED"]);

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 60, windowMs: 60_000, key: "supportAgentReply", requireDurable: true }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const supportCase = await loadAssignedSupportCase(auth.admin, auth.user, body.case_id);
    if (!supportCase) return res.status(404).json({ error: "Assigned support case not found." });
    if (supportCase.status === "CLOSED") return res.status(409).json({ error: "Closed cases cannot receive staff replies." });

    const message = cleanSupportMessage(body.message || "");
    if (!message) return res.status(400).json({ error: "Reply is required." });
    const requestedStatus = String(body.status || "NEEDS_USER").toUpperCase();
    if (!ALLOWED_NEXT_STATUS.has(requestedStatus)) return res.status(400).json({ error: "Invalid support status transition." });

    const role = supportRole(auth.user);
    // Sender identity is an authenticated fact, not a workflow status. A support
    // agent may route a case to ENGINEERING, but must not impersonate Engineering.
    const senderKind = role === "support_engineering" ? "engineering" : "agent";

    const { data: supportMessage, error: messageError } = await auth.admin
      .from("support_messages")
      .insert({
        case_id: supportCase.id,
        sender_user_id: auth.user.id,
        sender_kind: senderKind,
        body: message,
        metadata: { role, requested_status: requestedStatus },
      })
      .select("id,sender_kind,body,metadata,created_at")
      .single();
    if (messageError?.code === "23514") return res.status(409).json({ error: "This case changed state before the reply was saved. Refresh and try again." });
    if (messageError) throw messageError;

    const { error: eventError } = await auth.admin.from("support_case_events").insert({
      case_id: supportCase.id,
      actor_user_id: auth.user.id,
      event_type: requestedStatus === "RESOLVED" ? "case_resolved" : "staff_replied",
      from_status: supportCase.status,
      to_status: requestedStatus,
      details: { role },
    });
    if (eventError) logError("supportAgentReply:event", eventError, { caseId: supportCase.id });

    await writeSupportAuditBestEffort(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: requestedStatus === "RESOLVED" ? "support_case_resolved" : "support_staff_reply_posted",
      targetType: "support_message",
      targetId: supportMessage.id,
      metadata: { from_status: supportCase.status, to_status: requestedStatus, role },
    }, "supportAgentReply:audit");

    return res.status(201).json({ message: supportMessage, status: requestedStatus });
  } catch (error) {
    logError("supportAgentReply", error);
    captureApiException(error, { tags: { route: "supportAgentReply" } });
    return res.status(500).json({ error: "Support staff reply could not be saved." });
  }
}
