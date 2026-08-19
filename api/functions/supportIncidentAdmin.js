import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { cleanSupportMessage, isSupportAdmin, loadAssignedSupportCase, writeSupportAuditBestEffort } from "../_lib/support.js";

const INCIDENT_STATUS = new Set(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]);
const SEVERITIES = new Set(["P0", "P1", "P2", "P3"]);

function clean(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 30, windowMs: 60_000, key: "supportIncidentAdmin", requireDurable: true }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!isSupportAdmin(auth.user)) return res.status(403).json({ error: "Support admin access required." });

  try {
    const body = readJson(req);
    const action = String(body.action || "list").toLowerCase();

    if (action === "list") {
      const { data, error } = await auth.admin.from("support_incidents").select("id,title,status,severity,public_summary,internal_summary,created_at,updated_at,resolved_at").order("updated_at", { ascending: false }).limit(200);
      if (error) throw error;
      return res.status(200).json({ incidents: data || [] });
    }

    if (action === "create") {
      const title = clean(body.title, 180);
      const severity = String(body.severity || "P2").toUpperCase();
      if (title.length < 3) return res.status(400).json({ error: "Incident title is required." });
      if (!SEVERITIES.has(severity)) return res.status(400).json({ error: "Invalid incident severity." });
      const { data, error } = await auth.admin.from("support_incidents").insert({
        title,
        severity,
        status: "INVESTIGATING",
        public_summary: body.public_summary ? cleanSupportMessage(body.public_summary, 4000) : null,
        internal_summary: body.internal_summary ? cleanSupportMessage(body.internal_summary, 8000) : null,
        created_by_id: auth.user.id,
      }).select("*").single();
      if (error) throw error;
      await writeSupportAuditBestEffort(auth.admin, { actorUserId: auth.user.id, action: "support_incident_created", targetType: "support_incident", targetId: data.id, metadata: { severity } }, "supportIncidentAdmin:createAudit");
      return res.status(201).json({ incident: data });
    }

    if (action === "update") {
      const incidentId = String(body.incident_id || "").trim();
      const status = String(body.status || "").toUpperCase();
      if (!incidentId || !INCIDENT_STATUS.has(status)) return res.status(400).json({ error: "Incident and valid status are required." });
      const patch = { status, updated_at: new Date().toISOString() };
      if (body.public_summary !== undefined) patch.public_summary = cleanSupportMessage(body.public_summary, 4000) || null;
      if (body.internal_summary !== undefined) patch.internal_summary = cleanSupportMessage(body.internal_summary, 8000) || null;
      patch.resolved_at = status === "RESOLVED" ? new Date().toISOString() : null;
      const { data, error } = await auth.admin.from("support_incidents").update(patch).eq("id", incidentId).select("*").maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Incident not found." });
      await writeSupportAuditBestEffort(auth.admin, { actorUserId: auth.user.id, action: "support_incident_updated", targetType: "support_incident", targetId: incidentId, metadata: { status } }, "supportIncidentAdmin:updateAudit");
      return res.status(200).json({ incident: data });
    }

    if (action === "link_case") {
      const incidentId = String(body.incident_id || "").trim();
      const caseId = String(body.case_id || "").trim();
      if (!incidentId || !caseId) return res.status(400).json({ error: "Incident and case are required." });
      const supportCase = await loadAssignedSupportCase(auth.admin, auth.user, caseId);
      if (!supportCase) return res.status(404).json({ error: "Support case not found." });
      const { data: incident, error: incidentError } = await auth.admin.from("support_incidents").select("id,title,status").eq("id", incidentId).maybeSingle();
      if (incidentError) throw incidentError;
      if (!incident) return res.status(404).json({ error: "Incident not found." });
      const { error } = await auth.admin.from("support_incident_cases").upsert({ incident_id: incidentId, case_id: caseId, linked_by_id: auth.user.id }, { onConflict: "incident_id,case_id" });
      if (error) throw error;
      const { error: eventError } = await auth.admin.from("support_case_events").insert({ case_id: caseId, actor_user_id: auth.user.id, event_type: "incident_linked", details: { incident_id: incidentId, incident_title: incident.title } });
      if (eventError) logError("supportIncidentAdmin:event", eventError, { caseId, incidentId });
      await writeSupportAuditBestEffort(auth.admin, { caseId, actorUserId: auth.user.id, action: "support_incident_linked", targetType: "support_incident", targetId: incidentId }, "supportIncidentAdmin:linkAudit");
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unsupported incident action." });
  } catch (error) {
    logError("supportIncidentAdmin", error);
    captureApiException(error, { tags: { route: "supportIncidentAdmin" } });
    return res.status(500).json({ error: "Support incident operation failed." });
  }
}
