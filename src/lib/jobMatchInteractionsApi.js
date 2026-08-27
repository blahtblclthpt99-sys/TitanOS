import { supabase } from "@/api/supabaseClient";
import { jobInteractionIdentity } from "./jobMatchIdentity.js";

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

export async function listMyJobMatchInteractions(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("job_match_interactions")
    .select("id,user_id,source,source_name,source_job_id,state,source_url,interview_at,follow_up_at,private_notes,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setMyJobMatchInteraction(userId, job, state) {
  if (!userId) throw new Error("Sign in to update job match state.");
  if (!ALLOWED_STATES.has(state)) throw new Error("Invalid job match state.");

  const { source, sourceName, sourceJobId, sourceUrl } = jobInteractionIdentity(job);
  if (!sourceJobId) throw new Error("Job reference is missing.");

  const row = {
    user_id: userId,
    created_by_id: userId,
    source,
    source_name: sourceName,
    source_job_id: sourceJobId,
    state,
    source_url: sourceUrl,
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

export async function saveMyCareerPipelineDetails(userId, interactionId, details = {}) {
  if (!userId || !interactionId) throw new Error("Application reference is missing.");
  const payload = {
    interview_at: details.interviewAt ? new Date(details.interviewAt).toISOString() : null,
    follow_up_at: details.followUpAt ? new Date(details.followUpAt).toISOString() : null,
    private_notes: String(details.notes || "").slice(0, 5000) || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("job_match_interactions")
    .update(payload)
    .eq("id", interactionId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Application was not found or is not owned by this account.");
  return data;
}

export async function clearMyJobMatchInteraction(userId, job) {
  if (!userId) return;
  const { source, sourceName, sourceJobId } = jobInteractionIdentity(job);
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
