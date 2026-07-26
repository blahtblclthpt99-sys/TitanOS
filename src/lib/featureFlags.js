/**
 * Feature flags — compile-time defaults, optional remote overlay, local kill switches.
 * Not a full LaunchDarkly replacement; enough for gradual rollouts and incident kills.
 */
import { envString } from "@/lib/viteEnv";

const LOCAL_KEY = "titanos_feature_flags_override_v1";
const CACHE_KEY = "titanos_feature_flags_remote_v1";

/** Public, non-secret flags. Defaults favor safe production behavior. */
export const DEFAULT_FEATURE_FLAGS = Object.freeze({
  driver_autopilot: true,
  titancom_ptt: true,
  ai_assistant: true,
  marketplace_install: true,
  product_analytics: true,
  session_replay: false,
  export_share_links: true,
  growth_coach: true,
  /** Kill switch — when false, hide Labs surfaces that look unfinished. */
  labs_surfaces: true,
  /** Referral program paused — restore by flipping true + re-adding nav. */
  referrals: false,
});

let memory = { ...DEFAULT_FEATURE_FLAGS };
let hydrated = false;

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* */
  }
}

function mergeFlags(...layers) {
  const out = { ...DEFAULT_FEATURE_FLAGS };
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    for (const [k, v] of Object.entries(layer)) {
      if (k in DEFAULT_FEATURE_FLAGS && typeof v === "boolean") out[k] = v;
    }
  }
  return out;
}

function parseEnvOverlay() {
  const raw = envString("VITE_FEATURE_FLAGS_JSON");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hydrateFeatureFlags() {
  const remote = readJson(CACHE_KEY);
  const local = readJson(LOCAL_KEY);
  memory = mergeFlags(parseEnvOverlay(), remote?.flags, local);
  hydrated = true;
  return memory;
}

export function getFeatureFlags() {
  if (!hydrated) hydrateFeatureFlags();
  return { ...memory };
}

export function isFeatureEnabled(flag) {
  if (!hydrated) hydrateFeatureFlags();
  return Boolean(memory[flag]);
}

/** Dev / support: local override (does not persist to server). */
export function setLocalFeatureFlag(flag, value) {
  if (!(flag in DEFAULT_FEATURE_FLAGS)) return getFeatureFlags();
  const local = { ...(readJson(LOCAL_KEY) || {}), [flag]: Boolean(value) };
  writeJson(LOCAL_KEY, local);
  memory = mergeFlags(parseEnvOverlay(), readJson(CACHE_KEY)?.flags, local);
  return { ...memory };
}

export function clearLocalFeatureOverrides() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* */
  }
  memory = mergeFlags(parseEnvOverlay(), readJson(CACHE_KEY)?.flags);
  return { ...memory };
}

/** Fetch public flags from API (best-effort). */
export async function refreshFeatureFlagsFromServer() {
  try {
    const res = await fetch("/api/functions/featureFlags", { credentials: "same-origin" });
    if (!res.ok) return getFeatureFlags();
    const data = await res.json();
    if (data?.flags && typeof data.flags === "object") {
      writeJson(CACHE_KEY, { flags: data.flags, fetchedAt: Date.now() });
      memory = mergeFlags(parseEnvOverlay(), data.flags, readJson(LOCAL_KEY));
    }
    if (data?.launch && typeof data.launch === "object") {
      try {
        const { applyLaunchStatus } = await import("@/lib/launchStatus");
        applyLaunchStatus(data.launch);
      } catch {
        /* */
      }
    }
  } catch {
    /* offline — keep cache */
  }
  return getFeatureFlags();
}

export function listFeatureFlagKeys() {
  return Object.keys(DEFAULT_FEATURE_FLAGS);
}
