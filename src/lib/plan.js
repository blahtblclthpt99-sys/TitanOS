/**
 * TitanOS billing / plan model.
 *
 * Launch mode: FREE_LAUNCH = true → every signed-in user gets all features.
 * When you turn monetization on later:
 *   1. Set FREE_LAUNCH to false
 *   2. Wire Stripe (or Play Billing) to set profiles.is_pro
 *   3. Gate premium features via canAccessFeature()
 */

export const FREE_LAUNCH = true;

/** Feature flags reserved for a future Pro tier. */
export const PRO_FEATURES = Object.freeze({
  reports: "reports",
  aiAssistant: "ai_assistant",
  fleet: "fleet",
  marketplace: "marketplace",
});

export function resolvePlan(user) {
  if (!user) return "anonymous";
  if (user.role === "admin" || user.is_pro === true) return "pro";
  return "free";
}

export function canAccessFeature(user, _featureKey) {
  if (FREE_LAUNCH) return Boolean(user);
  const plan = resolvePlan(user);
  return plan === "pro" || plan === "free"; // tighten per-feature when monetizing
}
