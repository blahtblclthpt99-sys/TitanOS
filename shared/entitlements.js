/**
 * Server + client shared entitlement matrix (no browser imports).
 * Profile-shaped objects: plan_tier, role, lifetime_premium, paying_subscriber,
 * founding_user, founding_trial_ends_at, founding_locked_plan, email.
 */

export const FEATURES = Object.freeze({
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

const STARTER_FEATURES = new Set([
  FEATURES.unlimitedEstimates,
  FEATURES.unlimitedInvoices,
  FEATURES.bookingPages,
  FEATURES.digitalContracts,
  FEATURES.gpsCheckIn,
]);

const PAID_WORKER_FEATURES = new Set([
  FEATURES.reports,
  FEATURES.aiAssistant,
  FEATURES.marketplaceApps,
  FEATURES.marketplacePremium,
  FEATURES.bookingPages,
  FEATURES.advancedAnalytics,
  FEATURES.featuredProfile,
  FEATURES.unlimitedEstimates,
  FEATURES.unlimitedInvoices,
  FEATURES.routeOptimization,
  FEATURES.ocrReceipts,
  FEATURES.digitalContracts,
  FEATURES.multiCompany,
  FEATURES.fleet,
  // driverAddons intentionally free — Driver Hub is not a paid add-on
  FEATURES.titanComPersist,
  FEATURES.gpsCheckIn,
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

/** Hardcoded owner emails (mirror src/lib/ownerAccount.js). */
const OWNER_EMAILS = new Set(
  ["mlafferty1991@yahoo.com", "blahtblclthpt99@gmail.com"].map((e) => e.toLowerCase())
);

export function isOwnerEmail(email) {
  const e = String(email || "").toLowerCase().trim();
  if (!e) return false;
  if (OWNER_EMAILS.has(e)) return true;
  const extra = String(process.env.OWNER_EMAILS || process.env.VITE_OWNER_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(e);
}

export function isFoundingTrialActive(profile) {
  if (!profile?.founding_user) return false;
  const ends = profile.founding_trial_ends_at;
  if (!ends) return profile.lifetime_premium === true;
  const t = new Date(ends).getTime();
  if (!Number.isFinite(t)) return profile.lifetime_premium === true;
  return Date.now() < t;
}

export function resolvePlanId(profile) {
  if (!profile) return "anonymous";
  if (profile.role === "admin") return "business";
  const raw = String(profile.plan_tier || profile.account_type || "").toLowerCase();
  if (raw === "customer" || profile.account_type === "customer") return "customer";
  if (raw === "business") return "business";
  if (raw === "starter") return "starter";
  if (
    raw === "worker_premium" ||
    raw === "premium" ||
    raw === "pro" ||
    profile.paying_subscriber === true ||
    profile.lifetime_premium === true
  ) {
    return "worker_premium";
  }
  if (profile.is_pro === true) return "worker_premium";
  if (raw === "worker_free" || raw === "free" || raw === "worker") return "worker_free";
  return "worker_free";
}

function planAllowsFeature(planId, featureKey) {
  if (!PAID_WORKER_FEATURES.has(featureKey)) return true;
  if (planId === "business" || planId === "worker_premium") return true;
  if (planId === "starter") return STARTER_FEATURES.has(featureKey);
  return false;
}

/**
 * Pure entitlement check from a profile (+ optional auth email).
 * @param {object|null} profile
 * @param {string} featureKey
 * @param {{ email?: string }} [auth]
 */
export function profileAllowsFeature(profile, featureKey, auth = {}) {
  if (!profile && !auth?.email) return false;
  const email = auth.email || profile?.email;
  if (isOwnerEmail(email)) return true;
  if (profile?.role === "admin") return true;

  // $0.99 Marketplace Modules pack (all apps) — not a membership tier
  if (
    featureKey === FEATURES.marketplaceApps &&
    profile?.marketplace_pack_unlocked === true
  ) {
    return true;
  }

  if (isFoundingTrialActive(profile)) {
    const locked = String(profile.founding_locked_plan || "worker_premium").toLowerCase();
    const planId = PLAN_ALIASES[locked] || locked || "worker_premium";
    const effective =
      planId === "starter" ? "starter" : planId === "business" ? "business" : "worker_premium";
    return planAllowsFeature(effective, featureKey);
  }

  if (profile?.lifetime_premium === true && profile?.founding_user) {
    return planAllowsFeature("worker_premium", featureKey);
  }

  if (profile?.founding_user && profile?.paying_subscriber === true) {
    const locked = String(profile.founding_locked_plan || resolvePlanId(profile) || "worker_premium").toLowerCase();
    const planId = PLAN_ALIASES[locked] || locked;
    return planAllowsFeature(planId, featureKey);
  }

  const plan = resolvePlanId(profile);
  if (plan === "customer") {
    if (featureKey === FEATURES.marketplace) return true;
    return !PAID_WORKER_FEATURES.has(featureKey);
  }
  return planAllowsFeature(plan, featureKey);
}

export function featureUpgradeHint(featureKey) {
  if (featureKey === FEATURES.marketplaceApps) {
    return "Unlock Marketplace modules for $0.99, or upgrade to Pro ($9.99) / Business ($19.99).";
  }
  if (featureKey === FEATURES.aiAssistant) {
    return "Titan AI requires Pro ($9.99) or Business ($19.99).";
  }
  if (featureKey === FEATURES.ocrReceipts) {
    return "Receipt OCR requires Pro ($9.99) or Business ($19.99).";
  }
  if (featureKey === FEATURES.routeOptimization) {
    return "Route optimization requires Pro ($9.99) or Business ($19.99).";
  }
  return "This feature requires a Pro or Business plan.";
}
