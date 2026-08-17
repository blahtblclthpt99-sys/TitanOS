import { supabase } from "@/api/supabaseClient";

const ALLOWED_PAY_TYPES = new Set(["hourly", "salary", "flat", "any"]);

function list(values, max = 30) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].slice(0, max);
}

async function getDriverQualifications(userId) {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("user_id,skills,certifications,years_experience,city,state,availability")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getPrivatePreferences(userId) {
  const { data, error } = await supabase
    .from("job_match_preferences")
    .select("user_id,job_interests,work_radius_miles,desired_pay_min,desired_pay_type,preferred_schedule,external_job_search_consent,external_job_search_consent_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getMyJobMatchPreferences(userId) {
  if (!userId) return null;
  const [profile, privatePrefs] = await Promise.all([
    getDriverQualifications(userId),
    getPrivatePreferences(userId),
  ]);
  if (!profile) return null;
  return {
    ...profile,
    job_interests: privatePrefs?.job_interests || [],
    work_radius_miles: Number(privatePrefs?.work_radius_miles || 50),
    desired_pay_min: Number(privatePrefs?.desired_pay_min || 0),
    desired_pay_type: privatePrefs?.desired_pay_type || "hourly",
    preferred_schedule: privatePrefs?.preferred_schedule || [],
    external_job_search_consent: Boolean(privatePrefs?.external_job_search_consent),
    external_job_search_consent_at: privatePrefs?.external_job_search_consent_at || null,
  };
}

export async function saveMyJobMatchPreferences(userId, patch = {}) {
  if (!userId) throw new Error("Sign in to save job matching preferences.");
  const current = await getMyJobMatchPreferences(userId);
  if (!current) throw new Error("Create your Driver Profile before enabling job matching.");

  const payType = String(patch.desired_pay_type ?? current.desired_pay_type ?? "hourly").trim().toLowerCase();
  const radius = Number(patch.work_radius_miles ?? current.work_radius_miles ?? 50);
  const desiredPay = Number(patch.desired_pay_min ?? current.desired_pay_min ?? 0);
  const consent = Boolean(patch.external_job_search_consent ?? current.external_job_search_consent);
  const previousConsent = Boolean(current.external_job_search_consent);

  const row = {
    user_id: userId,
    created_by_id: userId,
    job_interests: list(patch.job_interests ?? current.job_interests),
    work_radius_miles: Math.min(500, Math.max(1, Number.isFinite(radius) ? Math.round(radius) : 50)),
    desired_pay_min: Math.max(0, Number.isFinite(desiredPay) ? desiredPay : 0),
    desired_pay_type: ALLOWED_PAY_TYPES.has(payType) ? payType : "hourly",
    preferred_schedule: list(patch.preferred_schedule ?? current.preferred_schedule, 14),
    external_job_search_consent: consent,
    external_job_search_consent_at: consent && !previousConsent ? new Date().toISOString() : consent ? current.external_job_search_consent_at : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("job_match_preferences")
    .upsert(row, { onConflict: "user_id" })
    .select("user_id,job_interests,work_radius_miles,desired_pay_min,desired_pay_type,preferred_schedule,external_job_search_consent,external_job_search_consent_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Job matching preferences were not saved.");
  return { ...current, ...data };
}
