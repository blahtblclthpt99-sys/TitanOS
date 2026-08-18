import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { loadOwnedSupportCase } from "../_lib/support.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 90, windowMs: 60_000, key: "supportGetCase" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { case_id: caseId } = readJson(req);
    const supportCase = await loadOwnedSupportCase(auth.admin, auth.user.id, caseId);
    if (!supportCase) return res.status(404).json({ error: "Support case not found." });

    const [messagesResult, eventsResult, attachmentsResult, csatResult, incidentLinksResult] = await Promise.all([
      auth.admin.from("support_messages").select("id,sender_kind,body,metadata,created_at").eq("case_id", supportCase.id).order("created_at", { ascending: true }).limit(500),
      auth.admin.from("support_case_events").select("id,event_type,from_status,to_status,details,created_at").eq("case_id", supportCase.id).order("created_at", { ascending: true }).limit(300),
      auth.admin.from("support_attachments").select("id,file_name,mime_type,size_bytes,storage_path,created_at").eq("case_id", supportCase.id).order("created_at", { ascending: true }).limit(100),
      auth.admin.from("support_csat").select("id,solved,rating,comment,created_at").eq("case_id", supportCase.id).maybeSingle(),
      auth.admin.from("support_incident_cases").select("incident_id,support_incidents(id,title,status,severity,public_summary,updated_at,resolved_at)").eq("case_id", supportCase.id).limit(20),
    ]);

    for (const result of [messagesResult, eventsResult, attachmentsResult, csatResult, incidentLinksResult]) {
      if (result.error) throw result.error;
    }

    return res.status(200).json({
      case: supportCase,
      messages: messagesResult.data || [],
      events: eventsResult.data || [],
      attachments: attachmentsResult.data || [],
      csat: csatResult.data || null,
      incidents: (incidentLinksResult.data || []).map((row) => row.support_incidents).filter(Boolean),
    });
  } catch (error) {
    logError("supportGetCase", error);
    captureApiException(error, { tags: { route: "supportGetCase" } });
    return res.status(500).json({ error: "Support case could not be loaded." });
  }
}
