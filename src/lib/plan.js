/**
 * TitanOS launch pricing (membership catalog + limit UX).
 * Transaction fee *rates* are owned by the Fee Engine (`shared/feeEngine.js` + DB).
 * plan.feeRate values seed / display defaults and must stay aligned with fee seed rules.
 *
 * Founding 100: first users get free membership forever (`founding_user` + lifetime_premium).
 * Fees still apply on collected payments. After 100 founding slots, beta closes and
 * PayPal membership checkout goes live (see `isFreeDuringBeta` / migration 035).
 */
import { isOwnerAccount } from "@/lib/ownerAccount";
import {
  FOUNDING_USER_CAP,
  getLaunchStatus,
  isBetaActive,
  isMembershipCheckoutLive,
} from "@/lib/launchStatus";

export { FOUNDING_USER_CAP, isBetaActive, isMembershipCheckoutLive };

/**
 * True while founding spots remain — membership checkout hidden; founding users unlocked.
 * Prefer this over the deprecated FREE_DURING_BETA constant.
 */
export function isFreeDuringBeta() {
  return isBetaActive();
}

/**
 * @deprecated Use isFreeDuringBeta(). Kept as a getter-compatible alias for older imports
 * that expect a boolean at call time — always read via isFreeDuringBeta() in new code.
 */
export const FREE_DURING_BETA = false;

/** @deprecated Use isFreeDuringBeta / founding users */
export const FREE_LAUNCH = false;

export const BETA_PERK_LABEL = "Founding 100 perk";

/** Live PayPal No-Code Payment links (memberships only — no per-module checkout). */
export const PAYPAL_CHECKOUT = Object.freeze({
  /** Worker Premium — $29.99 */
  worker_premium: "https://www.paypal.com/ncp/payment/Q63SUKNY5AK58",
  /** Business — $49.99 */
  business: "https://www.paypal.com/ncp/payment/5V47YYFZVCNZ4",
});

/** @deprecated Modules are included with Premium/Business — always 0. */
export const PAYPAL_MODULE_PRICE = 0;
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
    blurb: "Try TitanOS with no monthly fee — 8% on payments you collect. Shift tracking included; premium Driver Hub add-ons require Premium.",
    checkoutUrl: null,
  }),
  worker_premium: Object.freeze({
    id: "worker_premium",
    name: "Worker Premium",
    audience: "Workers",
    launchPriceMonthly: 29.99,
    priceMonthly: 29.99,
    feeRate: 0.025,
    feeLabel: "2.5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Expanded photo & document storage",
    blurb: "$29.99/mo — lower 2.5% fee, Driver Hub add-ons, Marketplace Apps, lasting TitanCom channels.",
    checkoutUrl: PAYPAL_CHECKOUT.worker_premium,
  }),
  business: Object.freeze({
    id: "business",
    name: "Business",
    audience: "Businesses",
    launchPriceMonthly: 49.99,
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
    blurb: "$49.99/mo for teams — lowest 1.5% fee plus every Premium unlock.",
    checkoutUrl: PAYPAL_CHECKOUT.business,
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
  marketplaceApps: "marketplace_apps",
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
  driverAddons: "driver_addons",
  titanComPersist: "titancom_persist",
});

const PAID_WORKER_FEATURES = new Set([
  PRO_FEATURES.reports,
  PRO_FEATURES.aiAssistant,
  PRO_FEATURES.marketplaceApps,
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
  PRO_FEATURES.driverAddons,
  PRO_FEATURES.titanComPersist,
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
  if (!userOrPlanId) return applyBetaPricing(PLANS.worker_free);
  if (typeof userOrPlanId === "string") {
    const id = PLAN_ALIASES[userOrPlanId] || userOrPlanId;
    return applyBetaPricing(PLANS[id] || PLANS.worker_free);
  }
  const id = resolvePlan(userOrPlanId);
  if (id === "anonymous") return applyBetaPricing(PLANS.worker_free);
  return applyBetaPricing(PLANS[id] || PLANS.worker_free, userOrPlanId);
}

/** While founding beta is open, hide membership prices; founding users keep free access via lifetime_premium. */
function applyBetaPricing(plan, user) {
  if (!plan) return PLANS.worker_free;
  if (!isFreeDuringBeta()) return plan;
  if (plan.id !== "worker_premium" && plan.id !== "business") return plan;
  const founding = isFoundingUser(user);
  return {
    ...plan,
    priceMonthly: 0,
    checkoutUrl: null,
    blurb: founding
      ? `${plan.name} unlocked for Founding 100 — free membership; payment fees still apply.`
      : `${plan.name} is free during the Founding 100 window — payment fees still apply.`,
  };
}

export function isFoundingUser(user) {
  return Boolean(user?.founding_user);
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
  // Open founding window: unlock app features (fees still charged on payments).
  if (isFreeDuringBeta()) return true;
  if (isOwnerAccount(user)) return true;
  if (user.role === "admin") return true;
  // Founding 100 keep free membership after beta closes (fees still apply).
  if (isFoundingUser(user) || user.lifetime_premium === true) {
    if (resolvePlan(user) === "customer") {
      if (featureKey === PRO_FEATURES.marketplace) return true;
      return !PAID_WORKER_FEATURES.has(featureKey);
    }
    return true;
  }

  const plan = resolvePlan(user);
  if (plan === "customer") {
    if (featureKey === PRO_FEATURES.marketplace) return true;
    return !PAID_WORKER_FEATURES.has(featureKey);
  }
  if (plan === "worker_premium" || plan === "business") return true;
  if (!PAID_WORKER_FEATURES.has(featureKey)) return true;
  return false;
}

/** Driver Hub add-ons (DoorDash, coach, logbook, autopilot, voice, etc.). Shift start/stop stays free. */
export function canUseDriverAddons(user) {
  return canAccessFeature(user, PRO_FEATURES.driverAddons);
}

/** Marketplace Apps / modules catalog. Service listings stay available on free. */
export function canUseMarketplaceApps(user) {
  return canAccessFeature(user, PRO_FEATURES.marketplaceApps);
}

/** Persistent TitanCom channels (free users must remake daily). */
export function canPersistTitanComChannels(user) {
  return canAccessFeature(user, PRO_FEATURES.titanComPersist);
}

export function isMarketplaceFree(_user) {
  // Service listings remain free to browse/post within plan limits.
  return true;
}

export function betaBadgeLabel(user) {
  if (isFoundingUser(user)) {
    const n = user.founding_number;
    return n != null && n !== ""
      ? `Founding #${n} · free app (fees apply)`
      : "Founding 100 · free app (fees apply)";
  }
  const launch = getLaunchStatus();
  if (launch.betaActive && launch.spotsRemaining > 0) {
    return `Founding beta · ${launch.spotsRemaining} free spots left (fees apply)`;
  }
  return null;
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
      isFreeDuringBeta() || isFoundingUser(user)
        ? `You've hit the ${label} limit on Worker Free. Founding / Premium unlocks higher limits — see Pricing.`
        : `Worker Free allows up to ${limit} active ${label}. Upgrade to Worker Premium ($29.99/mo) for unlimited.`
    );
  }
}

/** PayPal / external checkout URL for a plan id, or null for free tiers / open founding beta. */
export function getPlanCheckoutUrl(planId) {
  if (isFreeDuringBeta() || !isMembershipCheckoutLive()) return null;
  const id = PLAN_ALIASES[planId] || planId;
  return PLANS[id]?.checkoutUrl || PAYPAL_CHECKOUT[id] || null;
}
