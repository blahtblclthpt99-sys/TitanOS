/**
 * TitanOS membership catalog + limit UX.
 * Transaction fee *rates* are owned by the Fee Engine (`shared/feeEngine.js` + DB).
 *
 * Plans: Free · Starter $4.99 · Pro $9.99 (Most Popular) · Business $19.99
 *
 * Founding 100: first 100 signups get month-1 free, then lifetime **price lock**
 * at founding rates (not free forever). Fees still apply on collected payments.
 * See migration 035 + 037.
 */
import { isOwnerAccount } from "@/lib/ownerAccount";
import {
  FOUNDING_USER_CAP,
  getLaunchStatus,
  isBetaActive,
  isMembershipCheckoutLive,
} from "@/lib/launchStatus";

export { FOUNDING_USER_CAP, isBetaActive, isMembershipCheckoutLive };

/** True while founding enrollment spots remain (not “everyone free”). */
export function isFreeDuringBeta() {
  return FREE_LAUNCH || isBetaActive();
}

/** @deprecated Prefer isFoundingEnrollmentOpen / isFoundingTrialActive */
export const FREE_DURING_BETA = true;
/** @deprecated */
export const FREE_LAUNCH = true;

export const BETA_PERK_LABEL = "Founding 100 · first month free";
export const FOUNDING_TRIAL_DAYS = 30;

/**
 * Live PayPal No-Code Payment links (NCP button amounts must match).
 * Legacy $29.99 / $49.99 membership amounts still map in paypal.js for in-flight payments.
 */
export const PAYPAL_CHECKOUT = Object.freeze({
  /** Starter — $4.99/mo */
  starter: "https://www.paypal.com/ncp/payment/TK7HZNKJWAKUL",
  /** Pro — $9.99/mo */
  worker_premium: "https://www.paypal.com/ncp/payment/Q63SUKNY5AK58",
  /** Business — $19.99/mo */
  business: "https://www.paypal.com/ncp/payment/5V47YYFZVCNZ4",
  /** Marketplace Modules pack — $0.99 unlocks all catalog modules */
  modules: "https://www.paypal.com/ncp/payment/USR42PN73VD9N",
});

/** Marketplace module pack price (all modules). Also included with Pro/Business. */
export const PAYPAL_MODULE_PRICE = 0.99;

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
    mostPopular: false,
  }),
  worker_free: Object.freeze({
    id: "worker_free",
    name: "Free",
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
    blurb: "Try TitanOS free — 8% on payments you collect. Limited estimates & hire posts.",
    checkoutUrl: null,
    mostPopular: false,
  }),
  starter: Object.freeze({
    id: "starter",
    name: "Starter",
    audience: "Individuals",
    launchPriceMonthly: 4.99,
    priceMonthly: 4.99,
    feeRate: 0.05,
    feeLabel: "5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: 10,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: false,
    searchPriority: false,
    storageLabel: "Basic photo & document storage",
    blurb: "$4.99/mo — dashboard, schedule, estimates, invoices, profit calculator, messaging.",
    checkoutUrl: PAYPAL_CHECKOUT.starter,
    mostPopular: false,
  }),
  worker_premium: Object.freeze({
    id: "worker_premium",
    name: "Pro",
    audience: "Pros & owner-operators",
    launchPriceMonthly: 9.99,
    priceMonthly: 9.99,
    feeRate: 0.025,
    feeLabel: "2.5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Expanded photo & document storage",
    blurb: "$9.99/mo — advanced profit calculator, AI, Tax Center, Marketplace Apps, Titan Radio persist.",
    checkoutUrl: PAYPAL_CHECKOUT.worker_premium,
    mostPopular: true,
  }),
  business: Object.freeze({
    id: "business",
    name: "Business",
    audience: "Teams & fleets",
    launchPriceMonthly: 19.99,
    priceMonthly: 19.99,
    feeRate: 0.015,
    feeLabel: "1.5%",
    maxActiveListings: Infinity,
    maxActiveHirePosts: Infinity,
    maxEstimatesPerMonth: Infinity,
    maxInvoicesPerMonth: Infinity,
    featuredProfile: true,
    searchPriority: true,
    storageLabel: "Priority photo & document storage",
    blurb: "$19.99/mo — everything in Pro plus teams, fleet, shared files, admin controls.",
    checkoutUrl: PAYPAL_CHECKOUT.business,
    mostPopular: false,
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
  label: "Lifetime Pro",
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
  leadOutreach: "lead_outreach",
});

/** Features unlocked on Starter ($4.99) — Pro adds the rest of PAID_WORKER_FEATURES. */
const STARTER_FEATURES = new Set([
  PRO_FEATURES.unlimitedEstimates,
  PRO_FEATURES.unlimitedInvoices,
  PRO_FEATURES.bookingPages,
  PRO_FEATURES.digitalContracts,
  PRO_FEATURES.gpsCheckIn,
]);

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
  // driverAddons intentionally free — Driver Hub is not a paid add-on
  PRO_FEATURES.titanComPersist,
  PRO_FEATURES.gpsCheckIn,
  PRO_FEATURES.leadOutreach,
]);

const PLAN_ALIASES = Object.freeze({
  free: "worker_free",
  starter: "starter",
  premium: "worker_premium",
  pro: "worker_premium",
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
  if (raw === "business") return "business";
  if (raw === "starter") return "starter";
  if (
    raw === "worker_premium" ||
    raw === "premium" ||
    raw === "pro" ||
    user.paying_subscriber === true ||
    user.lifetime_premium === true
  ) {
    return "worker_premium";
  }
  if (user.is_pro === true) return "worker_premium";
  if (raw === "worker_free" || raw === "free" || raw === "worker") return "worker_free";

  return "worker_free";
}

export function getPlanConfig(userOrPlanId) {
  if (!userOrPlanId) return applyFoundingDisplay(PLANS.worker_free);
  if (typeof userOrPlanId === "string") {
    const id = PLAN_ALIASES[userOrPlanId] || userOrPlanId;
    return applyFoundingDisplay(PLANS[id] || PLANS.worker_free);
  }
  const id = resolvePlan(userOrPlanId);
  if (id === "anonymous") return applyFoundingDisplay(PLANS.worker_free);
  return applyFoundingDisplay(PLANS[id] || PLANS.worker_free, userOrPlanId);
}

/** Founders in free trial month see $0 display for their locked plan. */
function applyFoundingDisplay(plan, user) {
  if (!plan) return PLANS.worker_free;
  if (!user || !isFoundingTrialActive(user)) return plan;
  const locked = String(user.founding_locked_plan || "worker_premium").toLowerCase();
  if (plan.id !== locked && !(locked === "pro" && plan.id === "worker_premium")) return plan;
  const lockPrice = Number(user.founding_price_lock);
  return {
    ...plan,
    priceMonthly: 0,
    checkoutUrl: null,
    blurb: `${plan.name} — Founding trial (free this month). Then locks at $${Number.isFinite(lockPrice) && lockPrice > 0 ? lockPrice.toFixed(2) : plan.launchPriceMonthly}/mo forever.`,
  };
}

export function isFoundingUser(user) {
  return Boolean(user?.founding_user);
}

/** First-month free window for Founding 100. */
export function isFoundingTrialActive(user) {
  if (!isFoundingUser(user)) return false;
  const ends = user.founding_trial_ends_at;
  if (!ends) {
    // Legacy founders with lifetime_premium keep entitlement
    return user.lifetime_premium === true;
  }
  const t = new Date(ends).getTime();
  if (!Number.isFinite(t)) return user.lifetime_premium === true;
  return Date.now() < t;
}

/** Lifetime locked monthly price for founders (after trial). */
export function getFoundingLockedPrice(user) {
  if (!isFoundingUser(user)) return null;
  const n = Number(user.founding_price_lock);
  if (Number.isFinite(n) && n > 0) return n;
  const planId = user.founding_locked_plan || "worker_premium";
  return PLANS[PLAN_ALIASES[planId] || planId]?.priceMonthly ?? PLANS.worker_premium.priceMonthly;
}

export function isPaidPlan(user) {
  const plan = resolvePlan(user);
  return plan === "starter" || plan === "worker_premium" || plan === "business";
}

export function isCustomerPlan(user) {
  return resolvePlan(user) === "customer";
}

function planAllowsFeature(planId, featureKey) {
  if (!PAID_WORKER_FEATURES.has(featureKey)) return true;
  if (planId === "business" || planId === "worker_premium") return true;
  if (planId === "starter") return STARTER_FEATURES.has(featureKey);
  return false;
}

export function canAccessFeature(user, featureKey) {
  if (!user) return false;
  if (isOwnerAccount(user)) return true;
  if (user.role === "admin") return true;

  // Active founding trial → Pro-level access (price lock defaults to Pro)
  if (isFoundingTrialActive(user)) {
    const locked = String(user.founding_locked_plan || "worker_premium").toLowerCase();
    const planId = PLAN_ALIASES[locked] || locked || "worker_premium";
    return planAllowsFeature(planId === "starter" ? "starter" : planId === "business" ? "business" : "worker_premium", featureKey);
  }

  // Legacy lifetime_premium founders (pre-037) keep full access
  if (user.lifetime_premium === true && isFoundingUser(user)) {
    return planAllowsFeature("worker_premium", featureKey);
  }

  // Founders after trial who are paying at locked price
  if (isFoundingUser(user) && user.paying_subscriber === true) {
    const locked = String(user.founding_locked_plan || resolvePlan(user) || "worker_premium").toLowerCase();
    const planId = PLAN_ALIASES[locked] || locked;
    return planAllowsFeature(planId, featureKey);
  }

  const plan = resolvePlan(user);
  if (plan === "customer") {
    if (featureKey === PRO_FEATURES.marketplace) return true;
    return !PAID_WORKER_FEATURES.has(featureKey);
  }
  return planAllowsFeature(plan, featureKey);
}

export function canUseDriverAddons(_user) {
  // Driver Hub intelligence (autopilot, voice, Explorer folders) is free — no Premium sub.
  return true;
}

export function canUseMarketplaceApps(user) {
  if (isFreeDuringBeta()) return true;
  if (user?.marketplace_pack_unlocked === true) return true;
  return canAccessFeature(user, PRO_FEATURES.marketplaceApps);
}

/** PayPal NCP URL for the $0.99 all-modules pack. */
export function getModulesCheckoutUrl() {
  return PAYPAL_CHECKOUT.modules || null;
}

export function canPersistTitanComChannels(user) {
  return canAccessFeature(user, PRO_FEATURES.titanComPersist);
}

export function isMarketplaceFree(_user) {
  return true;
}

export function betaBadgeLabel(user) {
  if (isFoundingUser(user)) {
    const n = user.founding_number;
    const prefix = n != null && n !== "" ? `Founding #${n}` : "Founding 100";
    if (isFoundingTrialActive(user) && user.founding_trial_ends_at) {
      return `${prefix} · free month · then $${getFoundingLockedPrice(user)}/mo locked`;
    }
    if (user.lifetime_premium === true) {
      return `${prefix} · legacy free membership (fees apply)`;
    }
    const locked = getFoundingLockedPrice(user);
    return `${prefix} · $${locked}/mo price lock`;
  }
  if (isFreeDuringBeta()) return "Free during beta";
  const launch = getLaunchStatus();
  if (launch.betaActive && launch.spotsRemaining > 0) {
    return `Founding 100 · ${launch.spotsRemaining} spots left · first month free`;
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
      `You've hit the ${label} limit on ${plan.name}. Upgrade to Pro ($${PLANS.worker_premium.priceMonthly}/mo) for higher limits.`
    );
  }
}

/** PayPal checkout URL for a plan id. Always live — founders use trial then locked price. */
export function getPlanCheckoutUrl(planId) {
  if (!isMembershipCheckoutLive() && !isFreeDuringBeta()) {
    // enrollment closed and payments flagged off
  }
  const id = PLAN_ALIASES[planId] || planId;
  if (id === "modules" || id === "marketplace_modules") return getModulesCheckoutUrl();
  return PLANS[id]?.checkoutUrl || PAYPAL_CHECKOUT[id] || null;
}
