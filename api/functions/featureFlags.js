import { applyCors, handleOptions } from "../_lib/cors.js";
import { logInfo } from "../_lib/safeLog.js";

/**
 * Public feature-flag snapshot (non-secret). Override via FEATURE_FLAGS_JSON env.
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
};

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
    /* ignore bad JSON */
  }
  return out;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const flags = loadFlags();
  logInfo("featureFlags", "served", { count: Object.keys(flags).length });
  return res.status(200).json({
    flags,
    ts: new Date().toISOString(),
  });
}
