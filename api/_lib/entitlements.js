/**
 * Server entitlement fortress — load profile from DB and assert feature access.
 * Never trust client plan_tier / is_pro flags alone.
 */
import { AppError } from "./apiError.js";
import {
  FEATURES,
  featureUpgradeHint,
  profileAllowsFeature,
} from "../../shared/entitlements.js";

export { FEATURES };

const PROFILE_SELECT = [
  "id",
  "email",
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
].join(",");

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} userId
 */
export async function loadEntitlementProfile(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{ id: string, email?: string }} user
 * @param {string} featureKey
 * @returns {Promise<{ ok: true, profile: object|null } | { ok: false, error: AppError }>}
 */
export async function checkFeature(admin, user, featureKey) {
  const profile = await loadEntitlementProfile(admin, user.id);
  const allowed = profileAllowsFeature(profile, featureKey, { email: user.email });
  if (!allowed) {
    return {
      ok: false,
      error: new AppError(featureUpgradeHint(featureKey), {
        status: 403,
        code: "PLAN_REQUIRED",
        category: "entitlement",
      }),
    };
  }
  return { ok: true, profile };
}

/**
 * Assert feature or write 403 and return null.
 * @returns {Promise<{ profile: object|null }|null>}
 */
export async function requireFeature(res, admin, user, featureKey) {
  try {
    const result = await checkFeature(admin, user, featureKey);
    if (!result.ok) {
      res.status(result.error.status).json({
        error: result.error.message,
        code: result.error.code,
        feature: featureKey,
      });
      return null;
    }
    return { profile: result.profile };
  } catch (err) {
    res.status(500).json({ error: "Could not verify plan entitlement" });
    return null;
  }
}
