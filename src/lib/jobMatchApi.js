import { api } from "@/api/apiClient";
import { supabase } from "@/api/supabaseClient";

/**
 * A degraded, fully source-attributed matcher for REAL TitanOS job postings.
 * It does not manufacture jobs, bypass RLS, or contact any outside provider.
 */
function safeLocalJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); }
  catch { return null; }
}

function savedResumeSkills(userId) {
  if (!userId || typeof localStorage === "undefined") return { skills: [], target: "" };
  // Résumé and job preferences are independent drafts. A malformed résumé
  // must not discard valid job preferences (or vice versa).
  const resume = safeLocalJson(`titanos:resume:v1:${userId}`);
  const prefs = safeLocalJson(`titanos:jobprefs:v1:${userId}`);
  const parseSkills = (value) => typeof value === "string"
    ? [...new Set(value.split(/[,;\\n]/).map((item) => item.trim().toLowerCase()).filter((item) => item.length > 1))].slice(0, 30)
    : [];
  const prefSkills = parseSkills(prefs?.skills);
  const resumeSkills = parseSkills(resume?.skills);
  const interests = typeof prefs?.interests === "string" ? prefs.interests.trim() : "";
  const headline = typeof resume?.headline === "string" ? resume.headline.trim() : "";
  const target = (interests ? interests.split(",")[0].trim() : headline).toLowerCase().slice(0, 150);
  return { skills: prefSkills.length ? prefSkills : resumeSkills, target };
}

export function rankNativePosting(job, profile) {
  const title = String(job.title || "").toLowerCase();
  const content = [job.title, job.description, job.category].filter(Boolean).join(" ").toLowerCase();
  const matchedSkills = (profile.skills || []).filter((skill) => content.includes(skill));
  const target = String(profile.target || "").trim().toLowerCase();
  const titleMatches = target && (title.includes(target) || target.includes(title));
  const skillScore = (profile.skills || []).length
    ? Math.round(80 * matchedSkills.length / profile.skills.length)
    : 0;
  const score = Math.min(100, skillScore + (titleMatches ? 20 : 0));
  const reasons = [];
  if (matchedSkills.length) reasons.push(`Posting mentions: ${matchedSkills.slice(0, 5).join(", ")}`);
  if (titleMatches) reasons.push("Position title aligns with the target role in your saved résumé");
  return { ...job, match: {
    score, reasons, blockers: [], source: "titan",
    score_method: "local_keyword_overlap",
    score_note: "Keyword alignment only. Qualifications, pay and eligibility must be verified manually.",
  } };
}

async function nativeFallback(includeExternal) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (authError || !userId) throw new Error("Sign in to retrieve current job postings.");

  const { data, error } = await supabase
    .from("hire_jobs")
    .select("id,title,description,category,city,state,budget_min,budget_max,deadline,created_at,status")
    .eq("status", "open")
    .limit(100);

  if (error) throw new Error("The live TitanOS jobs database is not reachable. Please try again later.");
  const today = new Date().toISOString().slice(0, 10);
  const postings = (data || []).filter((job) =>
    job?.id && job?.title && job.status === "open" && (!job.deadline || job.deadline >= today)
  );
  const profile = savedResumeSkills(userId);
  const hasMatchInputs = Boolean(profile.skills.length || profile.target);
  // Never hide real open positions merely because a new job seeker has not
  // completed a résumé yet. Unranked is not equivalent to a 0% qualification.
  const matches = hasMatchInputs
    ? postings.map((job) => rankNativePosting(job, profile)).sort((a, b) => b.match.score - a.match.score)
    : postings.map((job) => ({
      ...job,
      match: {
        score: null,
        reasons: [],
        blockers: [],
        source: "titan",
        score_method: "unranked",
        score_note: "Complete your skills or target role to see keyword alignment.",
      },
    }));

  return {
    matches,
    needsProfile: false,
    needsSkills: !profile.skills.length && !profile.target,
    radiusMode: "city_state",
    dataSource: "native_jobs_fallback",
    external: {
      requested: Boolean(includeExternal),
      enabled: false,
      reason: "provider_not_configured",
    },
  };
}

export async function getJobMatches({ includeExternal = true } = {}) {
  try {
    const response = await api.functions.invoke("jobMatchesV2", { includeExternal });
    if (response?.data && Array.isArray(response.data.matches)) return response.data;
  } catch {
    // Existing dedicated server is unavailable; use only real RLS-filtered
    // TitanOS jobs, never simulated positions or external scraping.
  }
  return nativeFallback(includeExternal);
}

export function jobMatchSourceLabel(job) {
  const source = job?.match?.source || job?.source || "titan";
  if (source === "external") return job?.match?.source_name || job?.source_name || "External provider";
  return "TitanOS";
}

export function isExternalJobMatch(job) {
  return (job?.match?.source || job?.source) === "external";
}
