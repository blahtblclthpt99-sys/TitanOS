/**
 * Founding-100 / launch status (client cache).
 * Source of truth: `platform_launch` via `/api/functions/featureFlags` (migrations 035 + 037).
 *
 * betaActive = founding enrollment still open (spots remaining).
 * membershipPaymentsLive = always true — Starter/Pro/Business checkout is live;
 * Founding 100 get month-1 free then locked pricing.
 */
const CACHE_KEY = "titanos_launch_status_v1";

export const FOUNDING_USER_CAP = 100;

/** @typedef {{ foundingCap: number, foundingClaimed: number, spotsRemaining: number, betaActive: boolean, membershipPaymentsLive: boolean, fetchedAt?: number }} LaunchStatus */

/** @type {LaunchStatus} */
let memory = {
  foundingCap: FOUNDING_USER_CAP,
  foundingClaimed: 0,
  spotsRemaining: FOUNDING_USER_CAP,
  /** Optimistic: founding enrollment open until server confirms closed. */
  betaActive: true,
  /** Checkout always available (founders use trial, then locked price). */
  membershipPaymentsLive: true,
};

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    /* */
  }
}

export function normalizeLaunchStatus(raw) {
  const cap = Math.max(1, Number(raw?.foundingCap ?? raw?.founding_cap) || FOUNDING_USER_CAP);
  const claimed = Math.max(0, Number(raw?.foundingClaimed ?? raw?.founding_claimed) || 0);
  const betaActive =
    raw?.betaActive != null
      ? Boolean(raw.betaActive)
      : raw?.beta_active != null
        ? Boolean(raw.beta_active)
        : claimed < cap;
  const membershipPaymentsLive =
    raw?.membershipPaymentsLive != null
      ? Boolean(raw.membershipPaymentsLive)
      : raw?.membership_payments_live != null
        ? Boolean(raw.membership_payments_live)
        : true;
  return {
    foundingCap: cap,
    foundingClaimed: claimed,
    spotsRemaining: Math.max(0, cap - claimed),
    betaActive,
    membershipPaymentsLive,
    fetchedAt: raw?.fetchedAt || Date.now(),
  };
}

export function hydrateLaunchStatus() {
  const cached = readCache();
  if (cached) memory = normalizeLaunchStatus(cached);
  return { ...memory };
}

export function getLaunchStatus() {
  return { ...memory };
}

export function isBetaActive() {
  return Boolean(memory.betaActive);
}

export function isMembershipCheckoutLive() {
  return Boolean(memory.membershipPaymentsLive);
}

export function applyLaunchStatus(raw) {
  memory = normalizeLaunchStatus({ ...raw, fetchedAt: Date.now() });
  writeCache(memory);
  return { ...memory };
}

/** Merge launch payload from featureFlags (or health) response. */
export async function refreshLaunchStatusFromServer() {
  try {
    const res = await fetch("/api/functions/featureFlags", { credentials: "same-origin" });
    if (!res.ok) return getLaunchStatus();
    const data = await res.json();
    if (data?.launch && typeof data.launch === "object") {
      return applyLaunchStatus(data.launch);
    }
  } catch {
    /* offline */
  }
  return getLaunchStatus();
}
