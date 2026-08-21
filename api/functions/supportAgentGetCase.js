import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { loadAssignedSupportCase, writeSupportAuditBestEffort } from "../_lib/support.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 120, windowMs: 60_000, key: "supportAgentGetCase" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { case_id: caseId } = readJson(req);
    const supportCase = await loadAssignedSupportCase(auth.admin, auth.user, caseId);
    if (!supportCase) return res.status(404).json({ error: "Assigned support case not found." });

    const [messages, diagnostics, events, attachments, assignments, incidents] = await Promise.all([
      auth.admin.from("support_messages").select("id,sender_user_id,sender_kind,body,metadata,created_at").eq("case_id", caseId).order("created_at", { ascending: true }).limit(750),
      auth.admin.from("support_diagnostics").select("id,payload,redaction_version,consented_at,created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(20),
      auth.admin.from("support_case_events").select("id,actor_user_id,event_type,from_status,to_status,details,created_at").eq("case_id", caseId).order("created_at", { ascending: true }).limit(500),
      auth.admin.from("support_attachments").select("id,file_name,mime_type,size_bytes,storage_path,created_at").eq("case_id", caseId).order("created_at", { ascending: true }).limit(100),
      auth.admin.from("support_agent_assignments").select("id,agent_user_id,assignment_role,active,created_at,ended_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(50),
      auth.admin.from("support_incident_cases").select("incident_id,support_incidents(id,title,status,severity,public_summary,internal_summary,updated_at,resolved_at)").eq("case_id", caseId).limit(50),
    ]);
    for (const result of [messages, diagnostics, events, attachments, assignments, incidents]) if (result.error) throw result.error;

    await writeSupportAuditBestEffort(auth.admin, {
      caseId,
      actorUserId: auth.user.id,
      action: "support_case_detail_viewed",
      targetType: "support_case",
      targetId: caseId,
      metadata: { diagnostics_viewed: (diagnostics.data || []).length > 0 },
    }, "supportAgentGetCase:audit");

    return res.status(200).json({
      case: supportCase,
      messages: messages.data || [],
      diagnostics: diagnostics.data || [],
      events: events.data || [],
      attachments: attachments.data || [],
      assignments: assignments.data || [],
      incidents: (incidents.data || []).map((row) => row.support_incidents).filter(Boolean),
    });
  } catch (error) {
    logError("supportAgentGetCase", error);
    captureApiException(error, { tags: { route: "supportAgentGetCase" } });
    return res.status(500).json({ error: "Support case details could not be loaded." });
  }
}
