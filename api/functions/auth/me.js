import { applyCors, handleOptions } from "../../_lib/cors.js";
import { getSupabaseAdmin, readJson } from "../../_lib/supabase.js";

function unauthorized(message = "Authentication required") {
  const error = new Error(message);
  error.status = 401;
  return error;
}

function extractBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || "";
  const value = Array.isArray(header) ? header[0] : header;
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function fetchProfile(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select(
      [
        "id",
        "full_name",
        "role",
        "is_pro",
        "lifetime_premium",
        "paying_subscriber",
        "plan_tier",
        "account_type",
        "founding_user",
        "founding_number",
        "founding_trial_ends_at",
        "founding_price_lock",
        "founding_locked_plan",
        "marketplace_pack_unlocked",
        "phone",
        "username",
        "avatar_url",
        "bio",
        "city",
        "state",
        "company_name",
        "company_address",
        "company_city",
        "company_state",
        "company_zip",
        "company_logo_url",
        "theme_pref",
        "notification_prefs",
        "marketing_prefs",
        "privacy_prefs",
        "professional_profile",
        "community_opt_in",
        "referral_code",
        "referred_by_code",
        "verified_worker",
        "verification_notes",
        "active_company_id",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }
  return data || null;
}

function buildUser(authUser, profile) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email,
    full_name:
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      "",
    role: profile?.role || "user",
    is_pro: profile?.is_pro ?? false,
    lifetime_premium: profile?.lifetime_premium ?? false,
    paying_subscriber: profile?.paying_subscriber ?? false,
    plan_tier: profile?.plan_tier || "",
    account_type: profile?.account_type || "",
    founding_user: profile?.founding_user ?? false,
    founding_number: profile?.founding_number ?? null,
    founding_trial_ends_at: profile?.founding_trial_ends_at ?? null,
    founding_price_lock: profile?.founding_price_lock ?? null,
    founding_locked_plan: profile?.founding_locked_plan ?? null,
    marketplace_pack_unlocked: profile?.marketplace_pack_unlocked === true,
    phone: profile?.phone || "",
    username: profile?.username || "",
    avatar_url: profile?.avatar_url || "",
    bio: profile?.bio || "",
    city: profile?.city || "",
    state: profile?.state || "",
    company_name: profile?.company_name || "",
    company_address: profile?.company_address || "",
    company_city: profile?.company_city || "",
    company_state: profile?.company_state || "",
    company_zip: profile?.company_zip || "",
    company_logo_url: profile?.company_logo_url || "",
    theme_pref: profile?.theme_pref || "system",
    notification_prefs: profile?.notification_prefs || {},
    marketing_prefs: profile?.marketing_prefs || {},
    privacy_prefs: profile?.privacy_prefs || {},
    professional_profile: profile?.professional_profile || {},
    community_opt_in: profile?.community_opt_in ?? false,
    referral_code: profile?.referral_code || "",
    referred_by_code: profile?.referred_by_code || "",
    verified_worker: profile?.verified_worker ?? false,
    verification_notes: profile?.verification_notes || "",
    active_company_id: profile?.active_company_id || "",
    created_date: profile?.created_at || authUser.created_at,
    updated_date: profile?.updated_at || authUser.updated_at,
  };
}

function pickProfileUpdates(input = {}) {
  const allowed = [
    "full_name",
    "phone",
    "username",
    "avatar_url",
    "bio",
    "city",
    "state",
    "company_name",
    "company_address",
    "company_city",
    "company_state",
    "company_zip",
    "company_logo_url",
    "theme_pref",
    "notification_prefs",
    "marketing_prefs",
    "privacy_prefs",
    "professional_profile",
    "community_opt_in",
    "referral_code",
    "referred_by_code",
    "active_company_id",
  ];
  return allowed.reduce((acc, key) => {
    if (input[key] !== undefined) acc[key] = input[key];
    return acc;
  }, {});
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);

  if (req.method !== "GET" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const admin = getSupabaseAdmin();
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  if (userError || !userResult?.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const authUser = userResult.user;

  if (req.method === "GET") {
    const profile = await fetchProfile(admin, authUser.id);
    return res.status(200).json(buildUser(authUser, profile));
  }

  const updates = pickProfileUpdates(readJson(req));
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: "No profile fields provided" });
  }

  const { error: updateError } = await admin
    .from("profiles")
    .upsert({ id: authUser.id, ...updates }, { onConflict: "id" });

  if (updateError) {
    return res.status(400).json({ error: updateError.message || "Profile update failed" });
  }

  const profile = await fetchProfile(admin, authUser.id);
  return res.status(200).json(buildUser(authUser, profile));
}