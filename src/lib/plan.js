/**
 * TitanOS billing / plan model.
 *
 * Beta mode: FREE_DURING_BETA = true → every signed-in user gets all features,
 * including Marketplace (completely free during beta).
 *
 * When paid launch begins:
 *   1. Set FREE_DURING_BETA to false
 *   2. Wire Stripe / Play Billing → profiles.paying_subscriber + is_pro
 *   3. Enable MARKETPLACE_PREMIUM for paid listing boosts / featured slots
 *   4. Referral: 3 verified paying subscribers → profiles.lifetime_premium
 */
export const FREE_DURING_BETA = true;

/** @deprecated Use FREE_DURING_BETA — kept so older imports keep working */
export const FREE_LAUNCH = FREE_DURING_BETA;

/** Toggle later for paid Marketplace boosts without rewriting listing CRUD. */
export const MARKETPLACE_PREMIUM = Object.freeze({
  enabled: false,
  featuredListingPrice: 9.99,
  boostDays: 7,
});

export const REFERRAL_REWARD = Object.freeze({
  requiredPayingReferrals: 3,
  reward: "lifetime_premium",
  label: "Lifetime TitanOS Premium",
});

/** Feature flags reserved for a future Pro tier. */
export const PRO_FEATURES = Object.freeze({
  reports: "reports",
  aiAssistant: "ai_assistant",
  fleet: "fleet",
  marketplace: "marketplace",
  marketplacePremium: "marketplace_premium",
  routeOptimization: "route_optimization",
  gpsCheckIn: "gps_check_in",
  ocrReceipts: "ocr_receipts",
});

export function resolvePlan(user) {
  if (!user) return "anonymous";
  if (user.role === "admin" || user.lifetime_premium === true || user.is_pro === true) {
    return "pro";
  }
  if (user.paying_subscriber === true) return "pro";
  return "free";
}

export function canAccessFeature(user, featureKey) {
  if (!user) return false;
  if (FREE_DURING_BETA) return true;

  if (featureKey === PRO_FEATURES.marketplacePremium) {
    return MARKETPLACE_PREMIUM.enabled && resolvePlan(user) === "pro";
  }

  const plan = resolvePlan(user);
  return plan === "pro";
}

export function isMarketplaceFree(_user) {
  return FREE_DURING_BETA || !MARKETPLACE_PREMIUM.enabled;
}

export function betaBadgeLabel() {
  return FREE_DURING_BETA ? "Free During Beta" : null;
}
