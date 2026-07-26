/**
 * Device-local observability preferences (Privacy → analytics / session replay).
 * Synced from profile privacy_prefs when available; defaults are privacy-first for replay.
 */
const KEY = "titanos_observability_prefs_v1";

export const DEFAULT_OBSERVABILITY_PREFS = Object.freeze({
  /** First-party product analytics (allowlisted events only). Default on; user can opt out. */
  product_analytics: true,
  /** Session replay — off until explicit opt-in + VITE_SENTRY_REPLAY. */
  session_replay: false,
});

export function getObservabilityPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_OBSERVABILITY_PREFS };
    const parsed = JSON.parse(raw);
    return {
      product_analytics:
        parsed.product_analytics === undefined
          ? DEFAULT_OBSERVABILITY_PREFS.product_analytics
          : Boolean(parsed.product_analytics),
      session_replay: Boolean(parsed.session_replay),
    };
  } catch {
    return { ...DEFAULT_OBSERVABILITY_PREFS };
  }
}

export function setObservabilityPrefs(partial = {}) {
  const next = { ...getObservabilityPrefs(), ...partial };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* */
  }
  try {
    window.dispatchEvent(new CustomEvent("titanos:observability-prefs", { detail: next }));
  } catch {
    /* */
  }
  return next;
}

/** Merge Privacy panel prefs into local observability store. */
export function syncObservabilityFromPrivacyPrefs(privacyPrefs = {}) {
  return setObservabilityPrefs({
    product_analytics:
      privacyPrefs.product_analytics === undefined
        ? DEFAULT_OBSERVABILITY_PREFS.product_analytics
        : Boolean(privacyPrefs.product_analytics),
    session_replay: Boolean(privacyPrefs.session_replay),
  });
}
