import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";

function uuidOrNull(value) {
  const clean = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)
    ? clean
    : null;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 20, windowMs: 60_000, key: "recordOpportunityResponse" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  const body = readJson(req);
  const applicationId = String(body.application_id || body.applicationId || "").trim();
  const opportunityId = String(body.opportunity_id || body.opportunityId || "").trim();
  if (!applicationId || !opportunityId) {
    return res.status(400).json({ error: "Application and opportunity are required." });
  }

  const { data: application, error: applicationError } = await auth.admin
    .from("hire_applications")
    .select("id,created_at,hire_job_id,worker_id,status")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError || !application) return res.status(404).json({ error: "Application not found." });

  if (String(application.worker_id) !== auth.user.id || String(application.hire_job_id) !== opportunityId) {
    return res.status(403).json({ error: "This application does not belong to your account and opportunity." });
  }

  const { data: opportunity, error: opportunityError } = await auth.admin
    .from("hire_jobs")
    .select("id,customer_id,created_by_id,relationship_type")
    .eq("id", opportunityId)
    .maybeSingle();
  if (opportunityError || !opportunity) return res.status(404).json({ error: "Opportunity not found." });

  const existingResult = await auth.admin
    .from("engagement_interaction_events")
    .select("id")
    .eq("subject_user_id", auth.user.id)
    .eq("opportunity_id", opportunityId)
    .eq("interaction_type", "opportunity_response")
    .eq("status", "responded")
    .contains("metadata", { application_id: applicationId })
    .maybeSingle();
  if (existingResult.error) return res.status(400).json({ error: "Could not verify existing interaction event." });
  if (existingResult.data) {
    return res.status(200).json({ data: { id: existingResult.data.id, recorded: false, duplicate: true } });
  }

  const counterpartyUserId = uuidOrNull(opportunity.customer_id || opportunity.created_by_id);
  const { data: created, error: createError } = await auth.admin
    .from("engagement_interaction_events")
    .insert({
      subject_user_id: auth.user.id,
      subject_kind: "worker",
      counterparty_user_id: counterpartyUserId,
      opportunity_id: opportunityId,
      interaction_type: "opportunity_response",
      status: "responded",
      attribution: "candidate",
      completed_at: application.created_at || new Date().toISOString(),
      occurred_at: application.created_at || new Date().toISOString(),
      metadata: {
        application_id: applicationId,
        relationship_type: opportunity.relationship_type || "employment",
        verified_from: "hire_applications",
      },
    })
    .select("id")
    .maybeSingle();
  if (createError || !created) return res.status(400).json({ error: "Could not record verified interaction event." });

  return res.status(200).json({ data: { id: created.id, recorded: true } });
}
