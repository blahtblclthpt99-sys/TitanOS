import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { logInfo, redactValue } from "../_lib/safeLog.js";
import { resolveRequestId, applyRequestIdHeader } from "../_lib/requestId.js";

const ALLOWED = new Set([
  "app_boot",
  "session_start",
  "page_view",
  "nav_tap",
  "cta_clicked",
  "cohort_page_view",
  "cohort_apply_start",
  "signup_completed",
  "success_story_submitted",
  "job_created",
  "invoice_created",
  "estimate_created",
  "payment_checkout_start",
  "payment_checkout_return",
  "driver_shift_start",
  "driver_shift_end",
  "search_query",
  "export_run",
  "ai_intent_used",
  "comms_ptt_start",
  "feature_flag_evaluated",
  "error_boundary",
]);

/**
 * Optional first-party analytics ingest.
 * Disabled unless ANALYTICS_INGEST_ENABLED=1. Events are allowlisted + redacted; no PII fields.
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  const requestId = resolveRequestId(req);
  applyRequestIdHeader(res, requestId);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (String(process.env.ANALYTICS_INGEST_ENABLED || "") !== "1") {
    return res.status(204).end();
  }

  if (!assertRateLimit(req, res, { key: "analyticsIngest", limit: 30, windowMs: 60_000 })) return;

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON", requestId });
    }
  }

  const events = Array.isArray(body?.events) ? body.events.slice(0, 40) : [];
  const accepted = [];
  for (const ev of events) {
    const name = String(ev?.name || "");
    if (!ALLOWED.has(name)) continue;
    accepted.push({
      name,
      props: redactValue(ev.props || {}),
      path: String(ev.path || "").slice(0, 120),
      ts: ev.ts || new Date().toISOString(),
    });
  }

  // Structured log sink — wire to warehouse later without changing clients
  if (accepted.length) {
    logInfo("analyticsIngest", "batch", { requestId, count: accepted.length, sample: accepted[0]?.name });
  }

  return res.status(200).json({ accepted: accepted.length, requestId });
}
