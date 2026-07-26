/**
 * First-party product analytics — allowlisted events, no PII, opt-out aware.
 * Local ring buffer always (when enabled); optional remote ingest when API is up.
 */
import { getObservabilityPrefs } from "@/lib/observabilityPrefs";
import { envFlag } from "@/lib/viteEnv";

/** Only these names may be recorded. */
export const ALLOWED_ANALYTICS_EVENTS = Object.freeze([
  "app_boot",
  "session_start",
  "page_view",
  "nav_tap",
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

const BUFFER_KEY = "titanos_analytics_buffer_v1";
const MAX_BUFFER = 80;

function allowed(name) {
  return ALLOWED_ANALYTICS_EVENTS.includes(String(name || ""));
}

function readBuffer() {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(rows) {
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(rows.slice(-MAX_BUFFER)));
  } catch {
    /* */
  }
}

/**
 * @param {string} name
 * @param {Record<string, string|number|boolean|null|undefined>} [props]
 */
export function trackEvent(name, props = {}) {
  if (!getObservabilityPrefs().product_analytics) return false;
  if (!allowed(name)) return false;

  const safeProps = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (/email|password|token|secret|phone|ssn|address|lat|lng|coordinate/i.test(k)) continue;
    if (typeof v === "string") safeProps[k] = v.slice(0, 80);
    else if (typeof v === "number" || typeof v === "boolean" || v == null) safeProps[k] = v;
  }

  const row = {
    name: String(name),
    props: safeProps,
    ts: new Date().toISOString(),
    path: typeof location !== "undefined" ? String(location.pathname || "").slice(0, 120) : "",
  };

  const buf = readBuffer();
  buf.push(row);
  writeBuffer(buf);

  if (envFlag("VITE_ANALYTICS_INGEST")) {
    void flushAnalyticsBuffer().catch(() => {});
  }
  return true;
}

export function peekAnalyticsBuffer() {
  return readBuffer();
}

export async function flushAnalyticsBuffer() {
  if (!getObservabilityPrefs().product_analytics) return { flushed: 0 };
  if (!envFlag("VITE_ANALYTICS_INGEST")) return { flushed: 0 };
  const rows = readBuffer();
  if (!rows.length) return { flushed: 0 };
  try {
    const res = await fetch("/api/functions/analyticsIngest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: rows.slice(-40) }),
      credentials: "same-origin",
    });
    if (res.ok) {
      writeBuffer([]);
      return { flushed: rows.length };
    }
  } catch {
    /* keep buffer */
  }
  return { flushed: 0 };
}

export function clearAnalyticsBuffer() {
  writeBuffer([]);
}
