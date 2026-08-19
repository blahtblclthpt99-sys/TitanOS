import { isFoundingTrialActive, resolvePlan } from "@/lib/plan";
import { isOwnerAccount } from "@/lib/ownerAccount";

/**
 * Advertising is a secondary monetization layer for ordinary free web/PWA users only.
 * Workspace identity never changes ad entitlement; billing does.
 * Owner/admin/test contexts are deliberately ad-free to reduce invalid-traffic risk.
 */
export const ADSENSE_ENABLED = String(import.meta.env.VITE_ADSENSE_ENABLED || "").toLowerCase() === "true";
export const ADSENSE_CONSENT_READY = String(import.meta.env.VITE_ADSENSE_CONSENT_READY || "").toLowerCase() === "true";
export const ADSENSE_PUBLISHER_ID = "pub-7224659901194043";
export const ADSENSE_CLIENT = String(
  import.meta.env.VITE_ADSENSE_CLIENT || `ca-${ADSENSE_PUBLISHER_ID}`
).trim();

const DEFAULT_ALLOWED_HOSTS = ["titanfieldos.com", "www.titanfieldos.com"];
export const ADSENSE_ALLOWED_HOSTS = Object.freeze(
  String(import.meta.env.VITE_ADSENSE_ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS.join(","))
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

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
const ADSENSE_CLIENT_PATTERN = /^ca-pub-\d{16}$/;
const ADSENSE_SLOT_PATTERN = /^\d{6,20}$/;

export function isValidAdSenseClient(value = ADSENSE_CLIENT) {
  return ADSENSE_CLIENT_PATTERN.test(String(value || "").trim());
}

export function isValidAdSenseSlot(value) {
  const slot = String(value || "").trim();
  return ADSENSE_SLOT_PATTERN.test(slot) && !/^0+$/.test(slot);
}

export function isAllowedAdHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  return Boolean(host) && ADSENSE_ALLOWED_HOSTS.includes(host);
}

export function getAdPlacement(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  return AD_PLACEMENTS[path] || null;
}

export function isAdSupportedPlan(user) {
  if (!user || user.role === "admin" || isOwnerAccount(user) || isFoundingTrialActive(user)) return false;
  return AD_SUPPORTED_PLANS.has(resolvePlan(user));
}

export function getAdSlot(placement) {
  return placement ? ADSENSE_SLOTS[placement] || "" : "";
}

export function getAdConfigIssues({ pathname = "/", hostname = "" } = {}) {
  const issues = [];
  const placement = getAdPlacement(pathname);
  const slot = getAdSlot(placement);

  if (!ADSENSE_ENABLED) issues.push("disabled");
  if (!ADSENSE_CONSENT_READY) issues.push("consent_not_ready");
  if (!isValidAdSenseClient()) issues.push("invalid_client");
  if (!placement) issues.push("unapproved_route");
  if (placement && !isValidAdSenseSlot(slot)) issues.push("invalid_slot");
  if (!isAllowedAdHost(hostname)) issues.push("unapproved_host");

  return issues;
}

export function shouldShowWebAd({ user, pathname, hostname, isNative = false } = {}) {
  if (isNative) return false;
  if (getAdConfigIssues({ pathname, hostname }).length) return false;
  return isAdSupportedPlan(user);
}
