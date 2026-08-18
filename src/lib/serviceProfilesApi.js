import { supabase } from "@/api/supabaseClient";

function list(values, max = 40) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].slice(0, max);
}

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name || "",
    bio: row.bio || "",
    services: row.services || [],
    skills: row.skills || [],
    serviceCity: row.service_city || "",
    serviceState: row.service_state || "",
    serviceRadiusMiles: Number(row.service_radius_miles || 30),
    pricingMode: row.pricing_mode || "quote",
    hourlyRate: Number(row.hourly_rate || 0),
    startingPrice: Number(row.starting_price || 0),
    availability: row.availability || "available",
    availabilityTags: row.availability_tags || [],
    licenses: row.licenses || [],
    certifications: row.certifications || [],
    equipment: row.equipment || [],
    insured: Boolean(row.insured),
    businessName: row.business_name || "",
    website: row.website || "",
    businessContact: row.business_contact || "",
    published: Boolean(row.published),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function getMyServiceProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("service_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}

export async function saveMyServiceProfile(userId, patch = {}) {
  if (!userId) throw new Error("Sign in to save your Service Profile.");
  const row = {
    user_id: userId,
    created_by_id: userId,
    display_name: String(patch.displayName || "").trim().slice(0, 120),
    bio: String(patch.bio || "").trim().slice(0, 4000),
    services: list(patch.services),
    skills: list(patch.skills),
    service_city: String(patch.serviceCity || "").trim().slice(0, 120),
    service_state: String(patch.serviceState || "").trim().slice(0, 60),
    service_radius_miles: Math.min(500, Math.max(1, Math.round(Number(patch.serviceRadiusMiles) || 30))),
    pricing_mode: ["hourly", "flat", "starting_at", "quote"].includes(patch.pricingMode) ? patch.pricingMode : "quote",
    hourly_rate: Math.max(0, Number(patch.hourlyRate) || 0),
    starting_price: Math.max(0, Number(patch.startingPrice) || 0),
    availability: ["available", "busy", "offline"].includes(patch.availability) ? patch.availability : "available",
    availability_tags: list(patch.availabilityTags, 14),
    licenses: list(patch.licenses),
    certifications: list(patch.certifications),
    equipment: list(patch.equipment),
    insured: Boolean(patch.insured),
    business_name: String(patch.businessName || "").trim().slice(0, 160),
    website: String(patch.website || "").trim().slice(0, 500),
    business_contact: String(patch.businessContact || "").trim().slice(0, 500),
    published: Boolean(patch.published),
    updated_at: new Date().toISOString(),
  };

  if (!row.display_name) throw new Error("Add a display name.");
  if (!row.services.length && !row.skills.length) throw new Error("Add at least one service or skill.");

  const { data, error } = await supabase
    .from("service_profiles")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Service Profile was not saved.");
  return normalize(data);
}

export async function getPublishedServiceProfileByUserId(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("service_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}

export async function listPublishedServiceProfiles() {
  const { data, error } = await supabase
    .from("service_profiles")
    .select("*")
    .eq("published", true)
    .neq("availability", "offline")
    .order("updated_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data || []).map(normalize).filter(Boolean);
}
