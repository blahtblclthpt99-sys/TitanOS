import { api } from "@/api/apiClient";

const SOURCE_KEY = "titan_autopilot_source";
const SOURCES = new Set(["product_hunt", "direct", "other"]);

function normalizeSource(value) {
  return SOURCES.has(value) ? value : "direct";
}

function safeInvoiceCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return Math.max(0, Math.min(10, parsed));
}

export function getAutopilotSource() {
  if (typeof window === "undefined") return "direct";

  try {
    const params = new URLSearchParams(window.location.search);
    const utm = String(params.get("utm_source") || "").toLowerCase();
    const referrer = String(document.referrer || "").toLowerCase();
    const stored = normalizeSource(sessionStorage.getItem(SOURCE_KEY));
    const detected = utm === "producthunt" || utm === "product_hunt" || referrer.includes("producthunt.com")
      ? "product_hunt"
      : stored === "product_hunt"
        ? "product_hunt"
        : referrer
          ? "other"
          : stored;
    sessionStorage.setItem(SOURCE_KEY, detected);
    return detected;
  } catch {
    return "direct";
  }
}

export async function trackAutopilotEvent(eventName, {
  mode = "unknown",
  invoiceCount = null,
  outcome = null,
} = {}) {
  try {
    await api.functions.invoke("trackAutopilotEvent", {
      event_name: eventName,
      source: getAutopilotSource(),
      mode,
      invoice_count: safeInvoiceCount(invoiceCount),
      outcome,
    });
  } catch {
    // Product telemetry is diagnostic only and never changes user-facing flow.
  }
}
