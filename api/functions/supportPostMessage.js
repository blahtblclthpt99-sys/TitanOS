import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { cleanSupportMessage, loadOwnedSupportCase, writeSupportAudit } from "../_lib/support.js";

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

    const nextStatus = supportCase.status === "NEEDS_USER" ? "AI_WORKING" : supportCase.status;
    const { error: updateError } = await auth.admin
      .from("support_cases")
      .update({
        status: nextStatus,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", supportCase.id)
      .eq("created_by_id", auth.user.id);
    if (updateError) throw updateError;

    if (nextStatus !== supportCase.status) {
      await auth.admin.from("support_case_events").insert({
        case_id: supportCase.id,
        actor_user_id: auth.user.id,
        event_type: "customer_replied",
        from_status: supportCase.status,
        to_status: nextStatus,
      });
    }

    await writeSupportAudit(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "customer_support_message_posted",
      targetType: "support_message",
      targetId: data.id,
    });

    return res.status(201).json({ message: data, status: nextStatus });
  } catch (error) {
    logError("supportPostMessage", error);
    captureApiException(error, { tags: { route: "supportPostMessage" } });
    return res.status(500).json({ error: "Support message could not be sent." });
  }
}
