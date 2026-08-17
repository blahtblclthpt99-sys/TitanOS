import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { buildWorkerMatchProfile, mergeRankedJobMatches, normalizeExternalJob, rankInternalJobMatches } from "../../src/lib/jobMatch.js";
import { filterByRadius } from "../../src/lib/jobMatchRadius.js";

const INTERNAL_TARGET = 10;
const EXTERNAL_LIMIT = 20;

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

function profileReady(profile) {
  return Boolean(profile && (profile.skills?.length || profile.job_interests?.length));
}

function externalQuery(profile) {
  return [...new Set([...(profile.job_interests || []).slice(0, 3), ...(profile.skills || []).slice(0, 5)])].join(" ").slice(0, 180);
}

function externalLocation(profile) {
  return [profile.city, profile.state].filter(Boolean).join(", ").slice(0, 120);
}

function normalizeAdzunaResult(row = {}) {
  const areas = Array.isArray(row.location?.area) ? row.location.area.filter(Boolean) : [];
  const state = areas.length >= 2 ? areas[areas.length - 2] : "";
  const city = areas.length ? areas[areas.length - 1] : row.location?.display_name || "";
  return normalizeExternalJob({
    external_id: row.id,
    title: row.title,
    description: row.description,
    category: row.category?.label || "General",
    city,
    state,
    lat: row.latitude,
    lng: row.longitude,
    budget_min: row.salary_min,
    budget_max: row.salary_max,
    source_url: row.redirect_url,
    posted_at: row.created,
    employment_type: row.contract_time === "full_time" ? "full_time" : row.contract_time === "part_time" ? "part_time" : "",
    pay_type: row.salary_min || row.salary_max ? "salary" : "",
  }, { name: "Adzuna" });
}

async function fetchAdzuna(profile) {
  const appId = String(process.env.ADZUNA_APP_ID || "").trim();
  const appKey = String(process.env.ADZUNA_APP_KEY || "").trim();
  if (!appId || !appKey) return { enabled: false, reason: "provider_not_configured", jobs: [] };
  const query = externalQuery(profile);
  if (!query) return { enabled: true, reason: "missing_worker_skills", jobs: [] };

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(EXTERNAL_LIMIT),
    what: query,
    where: externalLocation(profile),
    sort_by: "date",
    "content-type": "application/json",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return { enabled: true, reason: `provider_http_${response.status}`, jobs: [] };
    const body = await response.json().catch(() => ({}));
    const jobs = [];
    for (const row of Array.isArray(body.results) ? body.results : []) {
      try { jobs.push(normalizeAdzunaResult(row)); } catch { /* invalid provenance/result */ }
    }
    return { enabled: true, reason: jobs.length ? "ok" : "no_results", jobs };
  } catch (error) {
    return { enabled: true, reason: error?.name === "AbortError" ? "provider_timeout" : "provider_unavailable", jobs: [] };
  } finally {
    clearTimeout(timeout);
  }
}

function interactionKey(source, sourceName, sourceJobId) {
  return `${String(source || "titan").toLowerCase()}|${String(sourceName || "TitanOS").toLowerCase()}|${String(sourceJobId || "")}`;
}

function jobInteractionKey(job) {
  const external = job.source === "external" || job.match?.source === "external";
  const source = external ? "external" : "titan";
  const sourceName = external ? (job.source_name || job.match?.source_name || "External provider") : "TitanOS";
  const sourceJobId = external ? (job.external_id || job.source_job_id || job.id) : job.id;
  return interactionKey(source, sourceName, sourceJobId);
}

function annotateAndFilter(jobs, interactionMap, nativeSavedIds, nativeAppliedIds) {
  return (jobs || []).flatMap((job) => {
    const external = job.source === "external" || job.match?.source === "external";
    const interaction = interactionMap.get(jobInteractionKey(job));
    const nativeId = String(job.id || "");
    const state = !external && nativeAppliedIds.has(nativeId)
      ? "applied"
      : !external && nativeSavedIds.has(nativeId)
        ? "saved"
        : interaction?.state || null;
    if (state === "ignored") return [];
    return [{ ...job, interaction_state: state }];
  });
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 20, windowMs: 60_000, key: "jobMatchesV2" }))) return;

  try {
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: "Sign in to find matching jobs." });
    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: "Session expired. Please sign in again." });

    const userId = userData.user.id;
    const body = readJson(req);
    const [profileResult, prefsResult, jobsResult, interactionsResult, savesResult, appsResult] = await Promise.all([
      admin.from("driver_profiles").select("user_id,skills,certifications,years_experience,city,state,lat,lng,availability").eq("user_id", userId).maybeSingle(),
      admin.from("job_match_preferences").select("user_id,job_interests,work_radius_miles,desired_pay_min,desired_pay_type,preferred_schedule,external_job_search_consent").eq("user_id", userId).maybeSingle(),
      admin.from("hire_jobs").select("id,created_at,created_by_id,title,description,category,city,state,lat,lng,budget_min,budget_max,deadline,status,is_urgent,is_same_day,required_skills,required_certifications,minimum_years_experience,employment_type,pay_type,schedule_tags,work_mode").eq("status", "open").neq("created_by_id", userId).order("created_at", { ascending: false }).limit(250),
      admin.from("job_match_interactions").select("source,source_name,source_job_id,state").eq("user_id", userId),
      admin.from("hire_saves").select("hire_job_id").eq("user_id", userId),
      admin.from("hire_applications").select("hire_job_id,status").eq("worker_id", userId),
    ]);
    for (const result of [profileResult, prefsResult, jobsResult, interactionsResult, savesResult, appsResult]) {
      if (result.error) throw result.error;
    }

    const profile = profileResult.data;
    if (!profile) return res.status(200).json({ data: { matches: [], needsProfile: true, needsSkills: true, external: { requested: false, enabled: false, reason: "profile_required" } } });
    const worker = buildWorkerMatchProfile({ ...profile, ...(prefsResult.data || {}) });
    worker.lat = profile.lat == null ? null : Number(profile.lat);
    worker.lng = profile.lng == null ? null : Number(profile.lng);
    if (!profileReady(worker)) return res.status(200).json({ data: { matches: [], needsProfile: false, needsSkills: true, external: { requested: false, enabled: false, reason: "skills_required" } } });

    const nativeJobs = jobsResult.data || [];
    const internal = filterByRadius(rankInternalJobMatches(nativeJobs, worker), worker);
    const wantsExternal = body.includeExternal !== false && worker.external_job_search_consent && internal.length < INTERNAL_TARGET;
    let externalState = { requested: wantsExternal, enabled: false, reason: worker.external_job_search_consent ? "internal_inventory_sufficient" : "consent_required" };
    let externalJobs = [];
    if (wantsExternal) {
      const provider = await fetchAdzuna(worker);
      externalJobs = provider.jobs;
      externalState = { requested: true, enabled: provider.enabled, reason: provider.reason, provider: provider.enabled ? "Adzuna" : null };
    }

    const merged = filterByRadius(mergeRankedJobMatches({ internal: nativeJobs, external: externalJobs, driverProfile: worker }), worker);
    const interactionMap = new Map((interactionsResult.data || []).map((row) => [interactionKey(row.source, row.source_name, row.source_job_id), row]));
    const nativeSavedIds = new Set((savesResult.data || []).map((row) => String(row.hire_job_id)));
    const nativeAppliedIds = new Set((appsResult.data || []).map((row) => String(row.hire_job_id)));
    const matches = annotateAndFilter(merged, interactionMap, nativeSavedIds, nativeAppliedIds).slice(0, 40);

    return res.status(200).json({ data: {
      matches,
      needsProfile: false,
      needsSkills: false,
      internalCount: internal.length,
      radiusMode: worker.lat != null && worker.lng != null ? "precise" : "city_state_fallback",
      external: externalState,
    } });
  } catch (error) {
    logError("jobMatchesV2", error);
    captureApiException(error, { tags: { route: "jobMatchesV2" } });
    return res.status(500).json({ error: "Could not load job matches." });
  }
}
