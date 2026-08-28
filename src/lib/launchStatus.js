/**
 * Founding-100 / launch status.
 *
 * Public launch metadata may be cached for display, but payment readiness is
 * deliberately session-scoped. A previous browser session must never be able
 * to re-enable checkout from localStorage after the server kill switch changes.
 *
 * Source of truth: `/api/functions/featureFlags` -> `platform_launch`.
 */
const CACHE_KEY = "titanos_launch_status_v1";
const MAX_FOUNDING_CAP = 1_000_000;

export const FOUNDING_USER_CAP = 100;

/**
 * @typedef {{
 *   foundingCap: number,
 *   foundingClaimed: number,
 *   spotsRemaining: number,
 *   betaActive: boolean,
 *   membershipPaymentsLive: boolean,
 *   verified: boolean,
 *   source: string,
 *   fetchedAt?: number
 * }} LaunchStatus
 */

function safeFallback(source = "safe_fallback") {
  return {
    foundingCap: FOUNDING_USER_CAP,
    foundingClaimed: 0,
    spotsRemaining: FOUNDING_USER_CAP,
    betaActive: true,
    membershipPaymentsLive: false,
    verified: false,
    source,
    fetchedAt: Date.now(),
  };
}

/** @type {LaunchStatus} */
let memory = safeFallback();

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persist only non-financial display metadata. Payment readiness and verification
 * are intentionally never cached across browser sessions.
 */
function writeDisplayCache(value) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        foundingCap: value.foundingCap,
        foundingClaimed: value.foundingClaimed,
        spotsRemaining: value.spotsRemaining,
        betaActive: value.betaActive,
        fetchedAt: value.fetchedAt || Date.now(),
      })
    );
  } catch {
    /* storage is best-effort */
  }
}

function readInteger(raw, camel, snake) {
  const value = raw?.[camel] ?? raw?.[snake];
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function readBoolean(raw, camel, snake) {
  const value = raw?.[camel] ?? raw?.[snake];
  return typeof value === "boolean" ? value : null;
}

/**
 * Normalize a launch payload.
 *
 * `trustedServerResponse` may only be used for the object returned by a fresh,
 * successful same-origin featureFlags request in the current browser session.
 */
export function normalizeLaunchStatus(raw, { trustedServerResponse = false } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return safeFallback(trustedServerResponse ? "invalid_server_payload" : "safe_fallback");
  }

  const cap = readInteger(raw, "foundingCap", "founding_cap");
  const claimed = readInteger(raw, "foundingClaimed", "founding_claimed");
  const betaActive = readBoolean(raw, "betaActive", "beta_active");

  if (
    cap == null ||
    cap < 1 ||
    cap > MAX_FOUNDING_CAP ||
    claimed == null ||
    claimed < 0 ||
    claimed > cap ||
    betaActive == null
  ) {
    return safeFallback(trustedServerResponse ? "invalid_server_payload" : "invalid_cached_payload");
  }

  const serverVerified =
    trustedServerResponse === true &&
    raw.verified === true &&
    raw.source === "platform_launch";

  return {
    foundingCap: cap,
    foundingClaimed: claimed,
    spotsRemaining: cap - claimed,
    betaActive: betaActive && claimed < cap,
    membershipPaymentsLive:
      serverVerified && raw.membershipPaymentsLive === true,
    verified: serverVerified,
    source: serverVerified
      ? "platform_launch"
      : trustedServerResponse
        ? String(raw.source || "unverified_server")
        : "cache_display_only",
    fetchedAt:
      typeof raw.fetchedAt === "number" && Number.isFinite(raw.fetchedAt)
        ? raw.fetchedAt
        : Date.now(),
  };
}

/**
 * Hydrate display-only launch metadata. Cached state can never activate checkout.
 */
export function hydrateLaunchStatus() {
  const cached = readCache();
  memory = cached
    ? normalizeLaunchStatus(cached, { trustedServerResponse: false })
    : safeFallback();
  return { ...memory };
}

export function getLaunchStatus() {
  return { ...memory };
}

export function isBetaActive() {
  return memory.betaActive === true;
}

export function isLaunchStatusVerified() {
  return memory.verified === true && memory.source === "platform_launch";
}

export function isMembershipCheckoutLive() {
  return isLaunchStatusVerified() && memory.membershipPaymentsLive === true;
}

/**
 * Apply untrusted/local launch data. Kept for non-server callers and tests;
 * payment readiness remains off by design.
 */
export function applyLaunchStatus(raw) {
  memory = normalizeLaunchStatus(raw, { trustedServerResponse: false });
  writeDisplayCache(memory);
  return { ...memory };
}

/** Apply a fresh same-origin server launch payload for this browser session. */
export function applyLaunchStatusFromServer(raw) {
  memory = normalizeLaunchStatus(
    { ...raw, fetchedAt: Date.now() },
    { trustedServerResponse: true }
  );
  writeDisplayCache(memory);
  return { ...memory };
}

/**
 * Immediately revoke checkout readiness while preserving safe display metadata.
 * Used when refresh fails, a payload is absent, or the server cannot verify state.
 */
export function invalidateLaunchPaymentReadiness() {
  memory = {
    ...memory,
    membershipPaymentsLive: false,
    verified: false,
    source: memory.source === "platform_launch" ? "verification_expired" : memory.source,
  };
  return { ...memory };
}

/** Fetch launch state directly when a caller explicitly needs a refresh. */
export async function refreshLaunchStatusFromServer() {
  try {
    const res = await fetch("/api/functions/featureFlags", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return invalidateLaunchPaymentReadiness();
    const data = await res.json();
    if (data?.launch && typeof data.launch === "object" && !Array.isArray(data.launch)) {
      return applyLaunchStatusFromServer(data.launch);
    }
  } catch {
    /* offline/network failure must fail closed */
  }
  return invalidateLaunchPaymentReadiness();
}
