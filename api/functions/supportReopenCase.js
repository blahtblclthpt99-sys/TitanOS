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
  if (!(await assertRateLimitAsync(req, res, { limit: 5, windowMs: 60 * 60_000, key: "supportReopenCase", requireDurable: true }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const supportCase = await loadOwnedSupportCase(auth.admin, auth.user.id, body.case_id);
    if (!supportCase) return res.status(404).json({ error: "Support case not found." });
    if (!["RESOLVED", "CLOSED"].includes(supportCase.status)) {
      return res.status(409).json({ error: "Only resolved or closed support cases can be reopened." });
    }

    const { data: systemMessage, error: messageError } = await auth.admin
      .from("support_messages")
      .insert({
        case_id: supportCase.id,
        sender_kind: "system",
        body: "This support case was reopened. Previous messages, attachments, diagnostics, and audit history remain attached.",
        metadata: { event: "case_reopened" },
      })
      .select("id,created_at")
      .single();
    if (messageError?.code === "23514") return res.status(409).json({ error: "This case changed state before it could be reopened. Refresh and try again." });
    if (messageError) throw messageError;

    const { error: eventError } = await auth.admin.from("support_case_events").insert({
      case_id: supportCase.id,
      actor_user_id: auth.user.id,
      event_type: "case_reopened",
      from_status: supportCase.status,
      to_status: "NEW",
      details: { reopened_by: "customer" },
    });
    if (eventError) logError("supportReopenCase:event", eventError, { caseId: supportCase.id });

    await writeSupportAuditBestEffort(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "support_case_reopened",
      targetType: "support_message",
      targetId: systemMessage.id,
      metadata: { from_status: supportCase.status, to_status: "NEW" },
    }, "supportReopenCase:audit");

    return res.status(200).json({ success: true, status: "NEW" });
  } catch (error) {
    logError("supportReopenCase", error);
    captureApiException(error, { tags: { route: "supportReopenCase" } });
    return res.status(500).json({ error: "Support case could not be reopened." });
  }
}
