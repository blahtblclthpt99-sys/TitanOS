import { applyCors, handleOptions } from "../_lib/cors.js";
import { logInfo, logWarn } from "../_lib/safeLog.js";

/**
 * Public feature-flag snapshot (non-secret). Override via FEATURE_FLAGS_JSON env.
 * Also returns founding-100 launch status from `platform_launch` when Supabase is configured.
 */
const DEFAULTS = Object.freeze({
  driver_autopilot: true,
  titancom_ptt: true,
  ai_assistant: true,
  marketplace_install: true,
  product_analytics: true,
  session_replay: false,
  export_share_links: true,
  growth_coach: true,
  labs_surfaces: true,
  referrals: false,
});

const FOUNDING_CAP_DEFAULT = 100;
const MAX_FOUNDING_CAP = 1_000_000;

export function safeLaunchFallback() {
  return {
    foundingCap: FOUNDING_CAP_DEFAULT,
    foundingClaimed: 0,
    spotsRemaining: FOUNDING_CAP_DEFAULT,
    betaActive: true,
    membershipPaymentsLive: false,
    verified: false,
    source: "safe_fallback",
  };
}

export function normalizeFeatureFlags(raw) {
  const out = { ...DEFAULTS };
  if (!raw) return out;

  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return out;

    for (const [key, value] of Object.entries(parsed)) {
      if (key in DEFAULTS && typeof value === "boolean") out[key] = value;
    }
  } catch {
    // Bad configuration must not make the public route unavailable.
  }

  return out;
}

export function normalizeLaunchRecord(data, { membershipPaymentsLive = false } = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const cap = Number(data.founding_cap);
  const claimed = Number(data.founding_claimed);
  const betaFlag = data.beta_active;

  if (!Number.isSafeInteger(cap) || cap < 1 || cap > MAX_FOUNDING_CAP) return null;
  if (!Number.isSafeInteger(claimed) || claimed < 0 || claimed > cap) return null;
  if (typeof betaFlag !== "boolean") return null;

  return {
    foundingCap: cap,
    foundingClaimed: claimed,
    spotsRemaining: cap - claimed,
    betaActive: betaFlag && claimed < cap,
    membershipPaymentsLive: membershipPaymentsLive === true,
    verified: true,
    source: "platform_launch",
  };
}

function loadFlags() {
  return normalizeFeatureFlags(process.env.FEATURE_FLAGS_JSON || process.env.VITE_FEATURE_FLAGS_JSON || "");
}

async function loadLaunchStatus() {
  const fallback = safeLaunchFallback();

  try {
    const { getSupabaseAdmin } = await import("../_lib/supabase.js");
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("platform_launch")
      .select("founding_cap, founding_claimed, beta_active")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return fallback;

    const normalized = normalizeLaunchRecord(data, {
      membershipPaymentsLive: process.env.MEMBERSHIP_PAYMENTS_LIVE === "true",
    });

    if (!normalized) {
      logWarn("featureFlags", "invalid platform_launch record; serving safe fallback");
      return fallback;
    }

    return normalized;
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flags = loadFlags();
  const launch = await loadLaunchStatus();
  logInfo("featureFlags", "served", {
    count: Object.keys(flags).length,
    betaActive: launch.betaActive,
    foundingClaimed: launch.foundingClaimed,
    membershipPaymentsLive: launch.membershipPaymentsLive,
    verified: launch.verified,
    source: launch.source,
  });

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    flags,
    launch,
    ts: new Date().toISOString(),
  });
}
