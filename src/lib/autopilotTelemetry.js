import { api } from "@/api/apiClient";

const SOURCE_KEY = "titan_autopilot_source";
const SOURCES = new Set(["product_hunt", "direct", "other"]);

function normalizeSource(value) {
  return SOURCES.has(value) ? value : "direct";
}

export function getAutopilotSource() {
  if (typeof window === "undefined") return "direct";

  try {
    const params = new URLSearchParams(window.location.search);
    const utm = String(params.get("utm_source") || "").toLowerCase();
    const referrer = String(document.referrer || "").toLowerCase();
    const detected = utm === "producthunt" || utm === "product_hunt" || referrer.includes("producthunt.com")
      ? "product_hunt"
      : referrer
        ? "other"
        : normalizeSource(sessionStorage.getItem(SOURCE_KEY));
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
      invoice_count: Number.isInteger(Number(invoiceCount)) ? Math.max(0, Math.min(10, Number(invoiceCount))) : null,
      outcome,
    });
  } catch {
    // Product telemetry is diagnostic only and never changes user-facing flow.
  }
}
