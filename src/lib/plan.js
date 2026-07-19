/**
 * TitanOS launch pricing
 *
 * Customers — Free to join and hire (no platform fee)
 * Workers (Free) — 8% transaction fee
 * Workers (Premium) — $19.99/mo + 2.5% fee
 * Businesses — $49.99/mo + 1.5% fee
 *
 * FREE_DURING_BETA: premium features stay unlocked; fees & free-worker limits still apply.
 */
export const FREE_DURING_BETA = true;

/** @deprecated Use FREE_DURING_BETA */
export const FREE_LAUNCH = FREE_DURING_BETA;

export const PLANS = Object.freeze({
  customer: Object.freeze({
    id: "customer",
    name: "Customer",
    audience: "Customers",
    priceMonthly: 0,
    feeRate: 0,
    feeLabel: "0%",
    maxActiveListings: 0,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: 0,
    maxInvoicesPerMonth: 0,
    featuredProfile: false,
    searchPriority: false,
    storageLabel: "Hire locally at no cost",
    blurb: "Free to join and hire professionals.",
  }),
  worker_free: Object.freeze({
    id: "worker_free",
    name: "Worker Free",
    audience: "Workers",
    priceMonthly: 0,
    feeRate: 0.08,
    feeLabel: "8%",
    maxActiveListings: 3,
    maxActiveHirePosts: 2,
    maxEstimatesPerMonth: 15,
    maxInvoicesPerMonth: 15,
    featuredProfile: false,
    searchPriority: false,
    storageLabel: "Standard photo & document storage",
    blurb: "Try TitanOS with no monthly fee — 8% on payments you collect.",
  }),
  worker_premium: Object.freeze({
    id: "worker_premium",
    name: "Worker Premium",
    audience: "Workers",
    priceMonthly: 19.99,
    feeRate: 0.025,
    feeLabel: "2.5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Expanded photo & document storage",
    blurb: "$19.99/mo with a lower 2.5% fee as you book more work.",
  }),
  business: Object.freeze({
    id: "business",
    name: "Business",
    audience: "Businesses",
    priceMonthly: 49.99,
    feeRate: 0.015,
    feeLabel: "1.5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Priority photo & document storage",
    blurb: "$49.99/mo for teams — lowest 1.5% transaction fee.",
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
  label: "Lifetime Worker Premium",
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

const PAID_WORKER_FEATURES = new Set([
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

const PLAN_ALIASES = Object.freeze({
  free: "worker_free",
  premium: "worker_premium",
  pro: "business",
  worker: "worker_free",
  customer: "customer",
  business: "business",
  worker_free: "worker_free",
  worker_premium: "worker_premium",
});

export function resolvePlan(user) {
  if (!user) return "anonymous";
  if (user.role === "admin") return "business";

  const raw = String(user.plan_tier || user.account_type || "").toLowerCase();
  if (raw === "customer" || user.account_type === "customer") return "customer";
  if (raw === "business" || raw === "pro" || user.is_pro === true) return "business";
  if (
    raw === "worker_premium" ||
    raw === "premium" ||
    user.paying_subscriber === true ||
    user.lifetime_premium === true
  ) {
    return "worker_premium";
  }
  if (raw === "worker_free" || raw === "free" || raw === "worker") return "worker_free";

  // Default field users are workers on the free tier
  return "worker_free";
}

export function getPlanConfig(userOrPlanId) {
  if (!userOrPlanId) return PLANS.worker_free;
  if (typeof userOrPlanId === "string") {
    const id = PLAN_ALIASES[userOrPlanId] || userOrPlanId;
    return PLANS[id] || PLANS.worker_free;
  }
  const id = resolvePlan(userOrPlanId);
  if (id === "anonymous") return PLANS.worker_free;
  return PLANS[id] || PLANS.worker_free;
}

export function isPaidPlan(user) {
  const plan = resolvePlan(user);
  return plan === "worker_premium" || plan === "business";
}

export function isCustomerPlan(user) {
  return resolvePlan(user) === "customer";
}

export function canAccessFeature(user, featureKey) {
  if (!user) return false;
  if (FREE_DURING_BETA) return true;
  if (user.role === "admin") return true;

  const plan = resolvePlan(user);
  if (plan === "customer") {
    // Customers hire / browse — not the full pro CRM suite
    return featureKey === PRO_FEATURES.marketplace || !PAID_WORKER_FEATURES.has(featureKey);
  }
  if (plan === "worker_premium" || plan === "business") return true;
  if (!PAID_WORKER_FEATURES.has(featureKey)) return true;
  if (featureKey === PRO_FEATURES.marketplace) return true;
  return false;
}

export function isMarketplaceFree(_user) {
  return true;
}

export function betaBadgeLabel() {
  return FREE_DURING_BETA ? "Public Beta" : null;
}

export function assertWithinFreeLimit(user, kind, currentCount) {
  const plan = getPlanConfig(user);
  if (plan.id === "customer" && kind === "hirePosts") return;
  if (plan.id === "customer" && kind === "listings") {
    throw new Error("Marketplace listings are for workers. Switch to a Worker plan to post services.");
  }

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
      `Worker Free allows up to ${limit} active ${label}. Upgrade to Worker Premium ($19.99/mo) for unlimited.`
    );
  }
}
