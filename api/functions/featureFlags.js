import { applyCors, handleOptions } from "../_lib/cors.js";
import { logInfo } from "../_lib/safeLog.js";

/**
 * Public feature-flag snapshot (non-secret). Override via FEATURE_FLAGS_JSON env.
 * Also returns founding-100 launch status from `platform_launch` when Supabase is configured.
 */
const DEFAULTS = {
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
};

const FOUNDING_CAP_DEFAULT = 100;

function loadFlags() {
  const out = { ...DEFAULTS };
  const raw = process.env.FEATURE_FLAGS_JSON || process.env.VITE_FEATURE_FLAGS_JSON || "";
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed)) {
      if (k in DEFAULTS && typeof v === "boolean") out[k] = v;
    }
  } catch {
    /* ignore bad JSON; defaults are intentionally non-secret */
  }
  return out;
}

async function loadLaunchStatus() {
  const fallback = {
    foundingCap: FOUNDING_CAP_DEFAULT,
    foundingClaimed: 0,
    spotsRemaining: FOUNDING_CAP_DEFAULT,
    betaActive: true,
    membershipPaymentsLive: false,
    verified: false,
    source: "safe_fallback",
  };
  try {
    const { getSupabaseAdmin } = await import("../_lib/supabase.js");
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("platform_launch")
      .select("founding_cap, founding_claimed, beta_active")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return fallback;
    const cap = Number(data.founding_cap) || FOUNDING_CAP_DEFAULT;
    const claimed = Number(data.founding_claimed) || 0;
    const betaActive = data.beta_active !== false && claimed < cap;
    return {
      foundingCap: cap,
      foundingClaimed: claimed,
      spotsRemaining: Math.max(0, cap - claimed),
      betaActive,
      membershipPaymentsLive: process.env.MEMBERSHIP_PAYMENTS_LIVE === "true",
      verified: true,
      source: "platform_launch",
    };
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
  });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    flags,
    launch,
    ts: new Date().toISOString(),
  });
}
