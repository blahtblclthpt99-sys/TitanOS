import { getSupabaseAdmin } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function unique(values = []) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

function tokens(value) {
  return unique(String(value || "").split(/[^a-z0-9+#.-]+/i));
}

function overlap(required = [], owned = []) {
  const need = unique(required);
  if (!need.length) return { ratio: 1, matched: [], missing: [] };
  const have = new Set(unique(owned).flatMap((item) => [item, ...tokens(item)]));
  const matched = need.filter((item) => have.has(item) || tokens(item).some((token) => have.has(token)));
  return { ratio: matched.length / need.length, matched, missing: need.filter((item) => !matched.includes(item)) };
}

function serviceTerms(profile) {
  return unique([...(profile?.services || []), ...(profile?.skills || [])]);
}

function opportunityTerms(job) {
  return unique([
    ...(job.required_skills || []),
    job.category,
    job.title,
    ...tokens(job.category),
    ...tokens(job.title),
  ]).filter((term) => term.length >= 3);
}

function locationScore(profile, job) {
  if (clean(job.work_mode) === "remote") return { ratio: 1, reason: "Remote opportunity" };
  const city = clean(profile?.service_city);
  const state = clean(profile?.service_state);
  const jobCity = clean(job.city);
  const jobState = clean(job.state);
  if (city && jobCity === city && (!state || !jobState || state === jobState)) return { ratio: 1, reason: "In your service area" };
  if (state && jobState === state) return { ratio: 0.72, reason: "In your state" };
  if (!jobCity && !jobState) return { ratio: 0.6, reason: "Location flexible or not specified" };
  return { ratio: 0.2, reason: "Outside your primary service area" };
}

function scoreOpportunity(profile, job) {
  const terms = opportunityTerms(job);
  const service = overlap(terms.slice(0, Math.max(1, Math.min(terms.length, 8))), serviceTerms(profile));
  const credentials = overlap(job.required_certifications || [], [
    ...(profile?.licenses || []),
    ...(profile?.certifications || []),
  ]);
  const location = locationScore(profile, job);
  const availability = profile?.availability === "offline" ? 0.35 : profile?.availability === "busy" ? 0.65 : 1;

  const raw = service.ratio * 50 + credentials.ratio * 20 + location.ratio * 20 + availability * 10;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const reasons = [];
  if (service.matched.length) reasons.push(`Services/skills: ${service.matched.slice(0, 3).join(", ")}`);
  if (credentials.matched.length) reasons.push(`Credentials: ${credentials.matched.slice(0, 2).join(", ")}`);
  if (location.ratio >= 0.7) reasons.push(location.reason);
  if (profile?.availability === "available") reasons.push("Currently available");

  const blockers = [];
  if (credentials.missing.length) blockers.push(`Missing required credential: ${credentials.missing.join(", ")}`);

  return {
    score,
    reasons,
    blockers,
    missing_certifications: credentials.missing,
    broad_discovery: false,
  };
}

function broadOpportunity(job, location = {}) {
  const locationResult = locationScore({ service_city: location.city, service_state: location.state }, job);
  const requirements = [];
  if (job.required_skills?.length) requirements.push("skills");
  if (job.required_certifications?.length) requirements.push("credentials");
  const score = locationResult.ratio >= 1 ? 70 : locationResult.ratio >= 0.7 ? 60 : locationResult.ratio >= 0.6 ? 52 : 42;
  return {
    ...job,
    match: {
      score,
      reasons: locationResult.ratio >= 0.6 ? [locationResult.reason] : [],
      blockers: requirements.length ? [`Complete your Service Profile so Titan can verify ${requirements.join(" and ")}.`] : [],
      missing_certifications: [],
      broad_discovery: true,
    },
  };
}

function relationshipLabel(type) {
  if (type === "customer_request") return "Customer Request";
  return "Contract Opportunity";
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 30, windowMs: 60_000, key: "workOpportunities" }))) return;

  try {
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: "Sign in to find independent work." });
    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: "Session expired. Please sign in again." });

    const userId = userData.user.id;
    const [accountResult, profileResult, jobsResult, appsResult, savesResult] = await Promise.all([
      admin.from("profiles").select("id,active_workspace,city,state").eq("id", userId).maybeSingle(),
      admin.from("service_profiles").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("hire_jobs")
        .select("id,created_at,created_by_id,title,description,category,city,state,lat,lng,budget_min,budget_max,deadline,status,is_urgent,is_same_day,required_skills,required_certifications,employment_type,pay_type,schedule_tags,work_mode,relationship_type")
        .eq("status", "open")
        .in("relationship_type", ["contract", "customer_request"])
        .neq("created_by_id", userId)
        .order("created_at", { ascending: false })
        .limit(250),
      admin.from("hire_applications").select("hire_job_id,status").eq("worker_id", userId),
      admin.from("hire_saves").select("hire_job_id").eq("user_id", userId),
    ]);
    for (const result of [accountResult, profileResult, jobsResult, appsResult, savesResult]) {
      if (result.error) throw result.error;
    }

    if (clean(accountResult.data?.active_workspace) !== "self_employed") {
      return res.status(403).json({ error: "Independent opportunities are available in the Independent Work workspace." });
    }

    const profile = profileResult.data;
    const hasProfile = Boolean(profile && ((profile.services || []).length || (profile.skills || []).length));
    const appliedIds = new Set((appsResult.data || []).map((row) => String(row.hire_job_id)));
    const savedIds = new Set((savesResult.data || []).map((row) => String(row.hire_job_id)));
    const rawJobs = jobsResult.data || [];

    const rows = hasProfile
      ? rawJobs
          .map((job) => ({ ...job, match: scoreOpportunity(profile, job) }))
          .filter((job) => !job.match.missing_certifications.length)
          .filter((job) => job.match.score >= 25)
          .sort((a, b) => b.match.score - a.match.score || Number(Boolean(b.is_urgent)) - Number(Boolean(a.is_urgent)) || String(b.created_at || "").localeCompare(String(a.created_at || "")))
      : rawJobs.map((job) => broadOpportunity(job, accountResult.data || {}));

    const opportunities = rows.slice(0, 60).map((job) => ({
      ...job,
      relationship_label: relationshipLabel(job.relationship_type),
      interaction_state: appliedIds.has(String(job.id)) ? "interested" : savedIds.has(String(job.id)) ? "saved" : null,
    }));

    return res.status(200).json({ data: {
      opportunities,
      needsProfile: !hasProfile,
      discoveryMode: hasProfile ? "matched" : "broad",
      counts: {
        total: opportunities.length,
        strong: opportunities.filter((job) => Number(job.match?.score || 0) >= 80).length,
        customerRequests: opportunities.filter((job) => job.relationship_type === "customer_request").length,
        contracts: opportunities.filter((job) => job.relationship_type === "contract").length,
        interested: opportunities.filter((job) => job.interaction_state === "interested").length,
      },
    } });
  } catch (error) {
    logError("workOpportunities", error);
    captureApiException(error, { tags: { route: "workOpportunities" } });
    return res.status(500).json({ error: "Could not load independent work opportunities." });
  }
}
