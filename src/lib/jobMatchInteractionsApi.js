import { supabase } from "@/api/supabaseClient";

const ALLOWED_STATES = new Set([
  "saved",
  "ignored",
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "closed",
]);

function normalizeSource(value) {
  return String(value || "titan").toLowerCase() === "external" ? "external" : "titan";
}

export async function listMyJobMatchInteractions(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("job_match_interactions")
    .select("id,user_id,source,source_name,source_job_id,state,source_url,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setMyJobMatchInteraction(userId, job, state) {
  if (!userId) throw new Error("Sign in to update job match state.");
  const source = normalizeSource(job?.source);
  const sourceName = String(job?.source_name || (source === "titan" ? "TitanOS" : "External provider")).trim();
  const sourceJobId = String(source === "external" ? (job?.external_id || job?.source_job_id || job?.id) : (job?.id || job?.source_job_id)).trim();
  if (!sourceJobId) throw new Error("Job reference is missing.");
  if (!ALLOWED_STATES.has(state)) throw new Error("Invalid job match state.");

  const row = {
    user_id: userId,
    created_by_id: userId,
    source,
    source_name: sourceName,
    source_job_id: sourceJobId,
    state,
    source_url: source === "external" ? String(job?.source_url || job?.match?.source_url || "").trim() || null : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("job_match_interactions")
    .upsert(row, { onConflict: "user_id,source,source_name,source_job_id" })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function clearMyJobMatchInteraction(userId, job) {
  if (!userId) return;
  const source = normalizeSource(job?.source);
  const sourceName = String(job?.source_name || (source === "titan" ? "TitanOS" : "External provider")).trim();
  const sourceJobId = String(source === "external" ? (job?.external_id || job?.source_job_id || job?.id) : (job?.id || job?.source_job_id)).trim();
  if (!sourceJobId) return;
  const { error } = await supabase
    .from("job_match_interactions")
    .delete()
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_name", sourceName)
    .eq("source_job_id", sourceJobId);
  if (error) throw error;
}
