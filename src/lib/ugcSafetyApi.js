import { supabase } from "@/api/supabaseClient";

function throwIfError(error, fallback) {
  if (!error) return;
  const message = String(error.message || fallback || "Safety action failed");
  if (message.includes("Messaging is unavailable between these accounts")) {
    throw new Error("Messaging is unavailable between these accounts.");
  }
  throw new Error(message);
}

export const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or abuse",
  "Fraudulent listing or job",
  "Fake reviews or credentials",
  "Impersonation",
  "Other",
];

export async function submitUserReport(reporter, { targetId, targetName, reason, details, link }) {
  if (!reporter?.id) throw new Error("Sign in to report");
  if (!targetId) throw new Error("Missing report target");
  if (String(targetId) === String(reporter.id)) throw new Error("You can't report yourself");

  const { data, error } = await supabase
    .from("trust_reports")
    .insert({
      kind: "user",
      reporter_id: reporter.id,
      reporter_name: reporter.full_name || reporter.username || reporter.email || "User",
      target_id: targetId,
      target_name: targetName || "User",
      reason: reason || "Other",
      body: String(details || "").trim(),
      link: link || "",
      status: "open",
    })
    .select("id,kind,reporter_id,reporter_name,target_id,target_name,reason,body,link,status,created_at")
    .single();
  throwIfError(error, "Couldn't submit report");
  return data;
}

export async function listTrustReports({ status = "open" } = {}) {
  let query = supabase
    .from("trust_reports")
    .select("id,kind,reporter_id,reporter_name,target_id,target_name,reason,body,link,status,created_at,resolved_at,resolved_by")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  throwIfError(error, "Couldn't load moderation reports");
  return data || [];
}

export async function resolveTrustReport(reportId, status = "resolved") {
  const nextStatus = status === "dismissed" ? "dismissed" : "resolved";
  const { data: authData, error: authError } = await supabase.auth.getUser();
  throwIfError(authError, "Couldn't verify moderator");
  const reviewerId = authData.user?.id;
  if (!reviewerId) throw new Error("Sign in to moderate reports");

  const { data, error } = await supabase
    .from("trust_reports")
    .update({
      status: nextStatus,
      resolved_at: new Date().toISOString(),
      resolved_by: reviewerId,
    })
    .eq("id", reportId)
    .select("id,status,resolved_at,resolved_by")
    .single();
  throwIfError(error, "Couldn't update moderation report");
  return data;
}

export async function listBlockedUsers(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_blocks")
    .select("id,blocker_id,blocked_id,blocked_name,created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  throwIfError(error, "Couldn't load blocked users");
  return (data || []).map((row) => ({
    ...row,
    target_id: row.blocked_id,
    target_name: row.blocked_name,
  }));
}

export async function blockUser(userId, targetId, targetName = "") {
  if (!userId || !targetId) throw new Error("Missing block target");
  if (String(userId) === String(targetId)) throw new Error("You can't block yourself");

  const { data, error } = await supabase
    .from("user_blocks")
    .upsert(
      {
        blocker_id: userId,
        blocked_id: targetId,
        blocked_name: targetName || null,
      },
      { onConflict: "blocker_id,blocked_id" }
    )
    .select("id,blocker_id,blocked_id,blocked_name,created_at")
    .single();
  throwIfError(error, "Couldn't block user");
  return data;
}

export async function unblockUser(userId, targetId) {
  if (!userId || !targetId) return;
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId);
  throwIfError(error, "Couldn't unblock user");
}

export async function hasBlockedUser(userId, targetId) {
  if (!userId || !targetId) return false;
  const { data, error } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId)
    .maybeSingle();
  throwIfError(error, "Couldn't check block status");
  return Boolean(data?.id);
}
