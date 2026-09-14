import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { logError } from "../_lib/safeLog.js";

const EVENTS = new Set([
  "preview_view",
  "signed_in_view",
  "eligible_loaded",
  "batch_approved",
  "checkout_started",
  "checkout_returned",
  "membership_run_started",
  "one_time_run_started",
  "run_completed",
  "run_retryable",
  "run_failed",
]);
const SOURCES = new Set(["product_hunt", "direct", "other"]);
const MODES = new Set(["public", "one_time", "membership", "unknown"]);
const OUTCOMES = new Set(["completed", "retryable", "failed", "canceled", "pending", "prepared"]);

function pick(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function safeCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return Math.max(0, Math.min(10, parsed));
}

async function optionalUserId(admin, req) {
  const header = String(req.headers?.authorization || "");
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid analytics session token");
  return data.user.id;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Telemetry is non-critical to the workflow, but the public endpoint still
  // uses Titan's durable production rate limiter to keep spam out of the table.
  if (!(await assertRateLimitAsync(req, res, {
    limit: 30,
    windowMs: 60_000,
    key: "trackAutopilotEvent",
    requireDurable: true,
  }))) return;

  try {
    const body = readJson(req);
    const eventName = String(body.event_name || "").trim().toLowerCase();
    if (!EVENTS.has(eventName)) return res.status(400).json({ error: "Unsupported Autopilot event" });

    const admin = getSupabaseAdmin();
    let userId = null;
    try {
      userId = await optionalUserId(admin, req);
    } catch {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    const source = pick(body.source, SOURCES, "direct");
    const mode = pick(body.mode, MODES, "unknown");
    const outcome = body.outcome == null ? null : pick(body.outcome, OUTCOMES, null);
    const invoiceCount = safeCount(body.invoice_count);

    const { error } = await admin.from("autopilot_funnel_events").insert({
      user_id: userId,
      event_name: eventName,
      source,
      mode,
      invoice_count: invoiceCount,
      outcome,
    });
    if (error) throw error;

    return res.status(202).json({ tracked: true });
  } catch (error) {
    logError("trackAutopilotEvent", error);
    // Never expose storage/schema internals to a public analytics caller.
    return res.status(503).json({ error: "Autopilot telemetry is temporarily unavailable" });
  }
}
