const EVENT_NAMES = new Set([
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

function allowed(value, set, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return set.has(normalized) ? normalized : fallback;
}

function safeInvoiceCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return Math.max(0, Math.min(10, parsed));
}

export function classifyAutopilotSource(req) {
  const referer = String(req?.headers?.referer || req?.headers?.referrer || "").toLowerCase();
  if (referer.includes("producthunt.com") || /[?&]utm_source=producthunt(?:&|$)/.test(referer) || /[?&]utm_source=product_hunt(?:&|$)/.test(referer)) {
    return "product_hunt";
  }
  return referer ? "other" : "direct";
}

export async function recordAutopilotFunnel(admin, {
  userId = null,
  eventName,
  source = "direct",
  mode = "unknown",
  invoiceCount = null,
  outcome = null,
} = {}) {
  const normalizedEvent = allowed(eventName, EVENT_NAMES, null);
  if (!normalizedEvent) return false;

  const { error } = await admin.from("autopilot_funnel_events").insert({
    user_id: userId || null,
    event_name: normalizedEvent,
    source: allowed(source, SOURCES, "direct"),
    mode: allowed(mode, MODES, "unknown"),
    invoice_count: safeInvoiceCount(invoiceCount),
    outcome: outcome == null ? null : allowed(outcome, OUTCOMES, null),
  });

  // Funnel metrics are diagnostic only. They must never block checkout or a
  // customer-facing Autopilot run if the analytics migration is unavailable.
  return !error;
}
