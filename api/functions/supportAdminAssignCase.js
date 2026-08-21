import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { isSupportAdmin, isSupportStaff, supportRole, writeSupportAuditBestEffort } from "../_lib/support.js";

const ASSIGNMENT_ROLES = new Set(["support_agent", "senior_support", "support_engineering", "billing_support"]);

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 30, windowMs: 60_000, key: "supportAdminAssignCase", requireDurable: true }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!isSupportAdmin(auth.user)) return res.status(403).json({ error: "Support admin access required." });

  try {
    const body = readJson(req);
    const caseId = String(body.case_id || "").trim();
    const agentUserId = String(body.agent_user_id || "").trim();
    const active = body.active !== false;
    if (!caseId || !agentUserId) return res.status(400).json({ error: "Case and agent are required." });

    const [{ data: supportCase, error: caseError }, userResult] = await Promise.all([
      auth.admin.from("support_cases").select("id,case_number,status").eq("id", caseId).maybeSingle(),
      auth.admin.auth.admin.getUserById(agentUserId),
    ]);
    if (caseError) throw caseError;
    if (!supportCase) return res.status(404).json({ error: "Support case not found." });
    if (userResult.error || !userResult.data?.user) return res.status(404).json({ error: "Support agent account not found." });
    const targetUser = userResult.data.user;
    if (!isSupportStaff(targetUser)) return res.status(400).json({ error: "Target user does not have a support staff role." });

    const targetRole = supportRole(targetUser);
    const requestedAssignmentRole = String(body.assignment_role || targetRole);
    const assignmentRole = ASSIGNMENT_ROLES.has(requestedAssignmentRole)
      ? requestedAssignmentRole
      : targetRole === "admin" || targetRole === "support_admin" ? "senior_support" : "support_agent";

    let changed = false;
    if (active) {
      const { data: existing, error: existingError } = await auth.admin
        .from("support_agent_assignments")
        .select("id")
        .eq("case_id", caseId)
        .eq("agent_user_id", agentUserId)
        .eq("active", true)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) {
        const { error } = await auth.admin.from("support_agent_assignments").insert({
          case_id: caseId,
          agent_user_id: agentUserId,
          assignment_role: assignmentRole,
          assigned_by_id: auth.user.id,
          active: true,
        });
        if (error?.code !== "23505" && error) throw error;
        changed = !error;
      }
    } else {
      const { data, error } = await auth.admin
        .from("support_agent_assignments")
        .update({ active: false, ended_at: new Date().toISOString() })
        .eq("case_id", caseId)
        .eq("agent_user_id", agentUserId)
        .eq("active", true)
        .select("id");
      if (error) throw error;
      changed = Boolean(data?.length);
    }

    if (changed) {
      const { error: eventError } = await auth.admin.from("support_case_events").insert({
        case_id: caseId,
        actor_user_id: auth.user.id,
        event_type: active ? "agent_assigned" : "agent_unassigned",
        details: { agent_user_id: agentUserId, assignment_role: assignmentRole },
      });
      if (eventError) logError("supportAdminAssignCase:event", eventError, { caseId });
    }

    await writeSupportAuditBestEffort(auth.admin, {
      caseId,
      actorUserId: auth.user.id,
      action: active ? "support_agent_assigned" : "support_agent_unassigned",
      targetType: "support_agent",
      targetId: agentUserId,
      metadata: { assignment_role: assignmentRole, changed },
    }, "supportAdminAssignCase:audit");

    return res.status(200).json({ success: true, active, changed, agent_user_id: agentUserId, assignment_role: assignmentRole });
  } catch (error) {
    logError("supportAdminAssignCase", error);
    captureApiException(error, { tags: { route: "supportAdminAssignCase" } });
    return res.status(500).json({ error: "Support assignment could not be updated." });
  }
}
