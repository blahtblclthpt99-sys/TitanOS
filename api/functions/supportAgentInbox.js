import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { isSupportAdmin, isSupportStaff, supportRole, writeSupportAudit } from "../_lib/support.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 90, windowMs: 60_000, key: "supportAgentInbox" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!isSupportStaff(auth.user)) return res.status(403).json({ error: "Support staff access required." });

  try {
    let cases = [];
    if (isSupportAdmin(auth.user)) {
      const { data, error } = await auth.admin
        .from("support_cases")
        .select("id,case_number,workspace,title,category,status,priority,source,platform,app_version,created_at,updated_at,last_message_at,escalated_at,resolved_at")
        .neq("status", "CLOSED")
        .order("priority", { ascending: true })
        .order("updated_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      cases = data || [];
    } else {
      const { data: assignments, error: assignmentError } = await auth.admin
        .from("support_agent_assignments")
        .select("case_id,assignment_role,created_at")
        .eq("agent_user_id", auth.user.id)
        .eq("active", true)
        .limit(250);
      if (assignmentError) throw assignmentError;
      const caseIds = (assignments || []).map((row) => row.case_id);
      if (caseIds.length) {
        const { data, error } = await auth.admin
          .from("support_cases")
          .select("id,case_number,workspace,title,category,status,priority,source,platform,app_version,created_at,updated_at,last_message_at,escalated_at,resolved_at")
          .in("id", caseIds)
          .neq("status", "CLOSED")
          .order("updated_at", { ascending: false });
        if (error) throw error;
        cases = data || [];
      }
    }

    const stats = {
      open: cases.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)).length,
      urgent: cases.filter((item) => ["P0", "P1"].includes(item.priority) && !["RESOLVED", "CLOSED"].includes(item.status)).length,
      waiting: cases.filter((item) => item.status === "NEEDS_USER").length,
      human: cases.filter((item) => item.status === "HUMAN_AGENT").length,
      engineering: cases.filter((item) => item.status === "ENGINEERING").length,
      ai_working: cases.filter((item) => item.status === "AI_WORKING").length,
    };

    await writeSupportAudit(auth.admin, {
      actorUserId: auth.user.id,
      action: "support_inbox_viewed",
      targetType: "support_inbox",
      metadata: { role: supportRole(auth.user), result_count: cases.length },
    });

    return res.status(200).json({ role: supportRole(auth.user), stats, cases });
  } catch (error) {
    logError("supportAgentInbox", error);
    captureApiException(error, { tags: { route: "supportAgentInbox" } });
    return res.status(500).json({ error: "Support inbox could not be loaded." });
  }
}
