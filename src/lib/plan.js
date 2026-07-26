/**
 * TitanOS launch pricing (membership catalog + limit UX).
 * Transaction fee *rates* are owned by the Fee Engine (`shared/feeEngine.js` + DB).
 * plan.feeRate values seed / display defaults and must stay aligned with fee seed rules.
 *
 * During FREE_DURING_BETA: memberships show $0 / "Free beta perk" (no PayPal checkout).
 * Post-beta launch prices stay in `launchPriceMonthly` for when we flip the flag.
 */
import { isOwnerAccount } from "@/lib/ownerAccount";

export const FREE_DURING_BETA = true;

/** @deprecated Use FREE_DURING_BETA */
export const FREE_LAUNCH = FREE_DURING_BETA;

export const BETA_PERK_LABEL = "Free beta perk";

/** Live PayPal No-Code Payment links for paid memberships (post-beta). */
export const PAYPAL_CHECKOUT = Object.freeze({
  worker_premium: "https://www.paypal.com/ncp/payment/Q63SUKNY5AK58",
  business: "https://www.paypal.com/ncp/payment/5V47YYFZVCNZ4",
});

export const PLANS = Object.freeze({
  customer: Object.freeze({
    id: "customer",
    name: "Customer",
    audience: "Customers",
    launchPriceMonthly: 0,
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
    checkoutUrl: null,
  }),
  worker_free: Object.freeze({
    id: "worker_free",
    name: "Worker Free",
    audience: "Workers",
    launchPriceMonthly: 0,
    priceMonthly: 0,
    feeRate: 0.08,
    feeLabel: "8%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: 2,
    maxEstimatesPerMonth: 15,
    maxInvoicesPerMonth: 15,
    featuredProfile: false,
    searchPriority: false,
    storageLabel: "Standard photo & document storage",
    blurb: FREE_DURING_BETA
      ? "Free beta perk — full worker tools while we launch."
      : "Try TitanOS with no monthly fee — 8% on payments you collect.",
    checkoutUrl: null,
  }),
  worker_premium: Object.freeze({
    id: "worker_premium",
    name: "Worker Premium",
    audience: "Workers",
    launchPriceMonthly: 29.99,
    priceMonthly: FREE_DURING_BETA ? 0 : 29.99,
    feeRate: 0.025,
    feeLabel: "2.5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Expanded photo & document storage",
    blurb: FREE_DURING_BETA
      ? "Free beta perk — Premium unlocked for early users."
      : "$29.99/mo with a lower 2.5% fee as you book more work.",
    checkoutUrl: FREE_DURING_BETA ? null : PAYPAL_CHECKOUT.worker_premium,
  }),
  business: Object.freeze({
    id: "business",
    name: "Business",
    audience: "Businesses",
    launchPriceMonthly: 49.99,
    priceMonthly: FREE_DURING_BETA ? 0 : 49.99,
    feeRate: 0.015,
    feeLabel: "1.5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Priority photo & document storage",
    blurb: FREE_DURING_BETA
      ? "Free beta perk — Business tools unlocked for early teams."
      : "$49.99/mo for teams — lowest 1.5% transaction fee.",
    checkoutUrl: FREE_DURING_BETA ? null : PAYPAL_CHECKOUT.business,
  }),
});

export const MARKETPLACE_PREMIUM = Object.freeze({
  enabled: false,
  featuredListingPrice: 0,
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
  // Explicit business tier only — do NOT treat legacy is_pro as Business (undercharges fees)
  if (raw === "business") return "business";
  if (
    raw === "worker_premium" ||
    raw === "premium" ||
    raw === "pro" ||
    user.paying_subscriber === true ||
    user.lifetime_premium === true
  ) {
    return "worker_premium";
  }
  // Legacy is_pro without a paid tier → Premium worker, not Business
  if (user.is_pro === true) return "worker_premium";
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
  if (isOwnerAccount(user)) return true;
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
      FREE_DURING_BETA
        ? `You've hit the ${label} limit on Worker Free. Premium is a free beta perk — contact support or switch plan in Settings.`
        : `Worker Free allows up to ${limit} active ${label}. Upgrade to Worker Premium ($29.99/mo) for unlimited.`
    );
  }
}

/** PayPal / external checkout URL for a plan id, or null for free tiers / beta. */
export function getPlanCheckoutUrl(planId) {
  if (FREE_DURING_BETA) return null;
  const id = PLAN_ALIASES[planId] || planId;
  return PLANS[id]?.checkoutUrl || PAYPAL_CHECKOUT[id] || null;
}
