import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { cleanSupportMessage, loadOwnedSupportCase, writeSupportAuditBestEffort } from "../_lib/support.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, {
    limit: 30,
    windowMs: 60_000,
    key: "supportPostMessage",
    requireDurable: true,
  }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const supportCase = await loadOwnedSupportCase(auth.admin, auth.user.id, body.case_id);
    if (!supportCase) return res.status(404).json({ error: "Support case not found." });
    if (supportCase.status === "CLOSED") {
      return res.status(409).json({ error: "This support case is closed. Reopen it before sending another message." });
    }

    const message = cleanSupportMessage(body.message || body.body || "");
    if (!message) return res.status(400).json({ error: "Message is required." });

    const { data, error } = await auth.admin
      .from("support_messages")
      .insert({
        case_id: supportCase.id,
        sender_user_id: auth.user.id,
        sender_kind: "customer",
        body: message,
        metadata: {},
      })
      .select("id,sender_kind,body,created_at")
      .single();
    if (error) throw error;

    const expectedStatus = supportCase.status === "NEEDS_USER" ? "AI_WORKING" : supportCase.status;
    if (supportCase.status === "NEEDS_USER") {
      const { error: eventError } = await auth.admin.from("support_case_events").insert({
        case_id: supportCase.id,
        actor_user_id: auth.user.id,
        event_type: "customer_replied",
        from_status: "NEEDS_USER",
        to_status: "AI_WORKING",
      });
      if (eventError) logError("supportPostMessage:event", eventError, { caseId: supportCase.id });
    }

    await writeSupportAuditBestEffort(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "customer_support_message_posted",
      targetType: "support_message",
      targetId: data.id,
    }, "supportPostMessage:audit");

    const { data: refreshed, error: refreshError } = await auth.admin
      .from("support_cases")
      .select("status")
      .eq("id", supportCase.id)
      .eq("created_by_id", auth.user.id)
      .maybeSingle();
    if (refreshError) logError("supportPostMessage:statusRefresh", refreshError, { caseId: supportCase.id });

    return res.status(201).json({ message: data, status: refreshed?.status || expectedStatus });
  } catch (error) {
    logError("supportPostMessage", error);
    captureApiException(error, { tags: { route: "supportPostMessage" } });
    return res.status(500).json({ error: "Support message could not be sent." });
  }
}
