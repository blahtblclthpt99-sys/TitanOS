/**
 * TitanOS billing / plan model.
 *
 * Free — 7.5% transaction fee, basic tools, limited listings & hire posts
 * Premium — $14.99/mo, 2.9% fee, unlimited core CRM + premium features
 * Pro — $24.99/mo, 2.5% fee, priority placement + advanced extras
 *
 * FREE_DURING_BETA: when true, premium features stay unlocked for all users,
 * but transaction fees and Free posting limits still apply.
 */
export const FREE_DURING_BETA = true;

/** @deprecated Use FREE_DURING_BETA */
export const FREE_LAUNCH = FREE_DURING_BETA;

export const PLANS = Object.freeze({
  free: Object.freeze({
    id: "free",
    name: "Free",
    priceMonthly: 0,
    feeRate: 0.075,
    feeLabel: "7.5%",
    maxActiveListings: 3,
    maxActiveHirePosts: 2,
    maxEstimatesPerMonth: 15,
    maxInvoicesPerMonth: 15,
    featuredProfile: false,
    searchPriority: false,
    storageLabel: "Standard photo & document storage",
  }),
  premium: Object.freeze({
    id: "premium",
    name: "Premium",
    priceMonthly: 14.99,
    feeRate: 0.029,
    feeLabel: "2.9%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Expanded photo & document storage",
  }),
  pro: Object.freeze({
    id: "pro",
    name: "Pro",
    priceMonthly: 24.99,
    feeRate: 0.025,
    feeLabel: "2.5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Priority photo & document storage",
  }),
});

export const MARKETPLACE_PREMIUM = Object.freeze({
  enabled: true,
  featuredListingPrice: 9.99,
  boostDays: 7,
});

export const REFERRAL_REWARD = Object.freeze({
  requiredPayingReferrals: 3,
  reward: "lifetime_premium",
  label: "Lifetime TitanOS Premium",
});

export const PRO_FEATURES = Object.freeze({
  reports: "reports",
  aiAssistant: "ai_assistant",
  fleet: "fleet",
  marketplace: "marketplace",
  marketplacePremium: "marketplace_premium",
  routeOptimization: "route_optimization",
  gpsCheckIn: "gps_check_in",
  ocrReceipts: "ocr_receipts",
  bookingPages: "booking_pages",
  digitalContracts: "digital_contracts",
  multiCompany: "multi_company",
  advancedAnalytics: "advanced_analytics",
  featuredProfile: "featured_profile",
  unlimitedEstimates: "unlimited_estimates",
  unlimitedInvoices: "unlimited_invoices",
});

const PREMIUM_FEATURES = new Set([
  PRO_FEATURES.reports,
  PRO_FEATURES.aiAssistant,
  PRO_FEATURES.marketplacePremium,
  PRO_FEATURES.bookingPages,
  PRO_FEATURES.advancedAnalytics,
  PRO_FEATURES.featuredProfile,
  PRO_FEATURES.unlimitedEstimates,
  PRO_FEATURES.unlimitedInvoices,
  PRO_FEATURES.routeOptimization,
  PRO_FEATURES.ocrReceipts,
  PRO_FEATURES.digitalContracts,
  PRO_FEATURES.multiCompany,
  PRO_FEATURES.fleet,
]);

export function resolvePlan(user) {
  if (!user) return "anonymous";
  if (user.role === "admin" || user.lifetime_premium === true || user.is_pro === true) {
    return "pro";
  }
  if (user.paying_subscriber === true || user.plan_tier === "premium") {
    return "premium";
  }
  if (user.plan_tier === "pro") return "pro";
  return "free";
}

export function getPlanConfig(userOrPlanId) {
  if (!userOrPlanId) return PLANS.free;
  if (typeof userOrPlanId === "string") {
    return PLANS[userOrPlanId] || PLANS.free;
  }
  const id = resolvePlan(userOrPlanId);
  if (id === "anonymous") return PLANS.free;
  return PLANS[id] || PLANS.free;
}

export function isPaidPlan(user) {
  const plan = resolvePlan(user);
  return plan === "premium" || plan === "pro";
}

export function canAccessFeature(user, featureKey) {
  if (!user) return false;
  if (FREE_DURING_BETA) return true;
  if (user.role === "admin") return true;

  const plan = resolvePlan(user);
  if (plan === "pro" || plan === "premium") return true;

  // Free plan: basic features only
  if (!PREMIUM_FEATURES.has(featureKey)) return true;
  if (featureKey === PRO_FEATURES.marketplace) return true;
  return false;
}

export function isMarketplaceFree(_user) {
  return true; // listings themselves stay free; Premium adds featured / priority
}

export function betaBadgeLabel() {
  return FREE_DURING_BETA ? "Public Beta" : null;
}

export function assertWithinFreeLimit(user, kind, currentCount) {
  const plan = getPlanConfig(user);
  const limits = {
    listings: plan.maxActiveListings,
    hirePosts: plan.maxActiveHirePosts,
    estimates: plan.maxEstimatesPerMonth,
    invoices: plan.maxInvoicesPerMonth,
  };
  const limit = limits[kind];
  if (limit == null || !Number.isFinite(limit)) return;
  if (currentCount >= limit) {
    const label =
      kind === "listings"
        ? "marketplace listings"
        : kind === "hirePosts"
          ? "hire job posts"
          : kind;
    throw new Error(
      `Free plan allows up to ${limit} active ${label}. Upgrade to Premium for unlimited.`
    );
  }
}
