import { resolvePlan } from "@/lib/plan";

/**
 * Advertising is a secondary monetization layer for free users only.
 * Workspace identity never changes ad entitlement; billing does.
 */
export const ADSENSE_ENABLED = String(import.meta.env.VITE_ADSENSE_ENABLED || "").toLowerCase() === "true";
export const ADSENSE_CLIENT = String(import.meta.env.VITE_ADSENSE_CLIENT || "").trim();

export const ADSENSE_SLOTS = Object.freeze({
  business_home: String(import.meta.env.VITE_ADSENSE_SLOT_BUSINESS_HOME || "").trim(),
  job_feed: String(import.meta.env.VITE_ADSENSE_SLOT_JOB_FEED || "").trim(),
  independent_home: String(import.meta.env.VITE_ADSENSE_SLOT_INDEPENDENT_HOME || "").trim(),
  independent_feed: String(import.meta.env.VITE_ADSENSE_SLOT_INDEPENDENT_FEED || "").trim(),
});

/**
 * Exact-route allowlist. Ads are intentionally excluded from auth, payments,
 * estimates/invoices, candidate/talent review, profiles, support/admin,
 * TitanAUTO actions, and fleet/driver safety surfaces.
 */
export const AD_PLACEMENTS = Object.freeze({
  "/": "business_home",
  "/hire/matches": "job_feed",
  "/independent": "independent_home",
  "/work-opportunities": "independent_feed",
});

const AD_SUPPORTED_PLANS = new Set(["worker_free", "customer"]);

export function getAdPlacement(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  return AD_PLACEMENTS[path] || null;
}

export function isAdSupportedPlan(user) {
  if (!user || user.role === "admin") return false;
  return AD_SUPPORTED_PLANS.has(resolvePlan(user));
}

export function getAdSlot(placement) {
  return placement ? ADSENSE_SLOTS[placement] || "" : "";
}

export function shouldShowWebAd({ user, pathname, isNative = false } = {}) {
  if (isNative || !ADSENSE_ENABLED || !ADSENSE_CLIENT) return false;
  const placement = getAdPlacement(pathname);
  if (!placement || !getAdSlot(placement)) return false;
  return isAdSupportedPlan(user);
}
