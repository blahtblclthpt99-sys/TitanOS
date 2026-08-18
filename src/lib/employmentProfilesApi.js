import { supabase } from "@/api/supabaseClient";

function list(values, max = 40) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].slice(0, max);
}

function normalize(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    profileId: row.id,
    userId: row.user_id,
    name: row.display_name || "",
    displayName: row.display_name || "",
    bio: row.bio || "",
    city: row.city || "",
    state: row.state || "",
    location: [row.city, row.state].filter(Boolean).join(", "),
    skills: row.skills || [],
    certifications: row.qualifications || [],
    qualifications: row.qualifications || [],
    yearsExperience: Number(row.years_experience || 0),
    availability: row.availability || "available",
    published: Boolean(row.discoverable),
    discoverable: Boolean(row.discoverable),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function getMyEmploymentProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("employment_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}

export async function saveMyEmploymentProfile(userId, patch = {}) {
  if (!userId) throw new Error("Sign in to save your Job Profile.");
  const row = {
    user_id: userId,
    created_by_id: userId,
    display_name: String(patch.displayName || patch.name || "").trim().slice(0, 120),
    bio: String(patch.bio || "").trim().slice(0, 4000),
    city: String(patch.city || "").trim().slice(0, 120),
    state: String(patch.state || "").trim().slice(0, 60),
    skills: list(patch.skills),
    qualifications: list(patch.qualifications || patch.certifications),
    years_experience: Math.min(80, Math.max(0, Math.round(Number(patch.yearsExperience ?? patch.years_experience ?? 0) || 0))),
    availability: ["available", "busy", "offline"].includes(patch.availability) ? patch.availability : "available",
    discoverable: Boolean(patch.discoverable ?? patch.published),
    updated_at: new Date().toISOString(),
  };

  if (!row.display_name) throw new Error("Add your name.");
  if (!row.skills.length && !row.qualifications.length) {
    throw new Error("Add at least one skill or qualification.");
  }

  const { data, error } = await supabase
    .from("employment_profiles")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Job Profile was not saved.");
  return normalize(data);
}

export async function listPublishedEmploymentProfiles() {
  const { data, error } = await supabase
    .from("employment_profiles")
    .select("*")
    .eq("discoverable", true)
    .neq("availability", "offline")
    .limit(250);
  if (error) throw error;
  return (data || []).map(normalize).filter(Boolean);
}

export async function getPublishedEmploymentProfileByUserId(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("employment_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("discoverable", true)
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}
