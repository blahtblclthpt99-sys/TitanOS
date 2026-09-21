const SOURCE_KEY = "titan_autopilot_source";

function publicSource() {
  if (typeof window === "undefined") return "direct";
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = String(params.get("utm_source") || "").toLowerCase();
    const referrer = String(document.referrer || "").toLowerCase();
    const stored = String(sessionStorage.getItem(SOURCE_KEY) || "").toLowerCase();
    const source = utm === "producthunt" || utm === "product_hunt" || referrer.includes("producthunt.com")
      ? "product_hunt"
      : stored === "product_hunt"
        ? "product_hunt"
        : referrer
          ? "other"
          : "direct";
    sessionStorage.setItem(SOURCE_KEY, source);
    return source;
  } catch {
    return "direct";
  }
}

export function trackPublicAutopilotPreview() {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  try {
    void fetch("/api/functions/trackAutopilotEvent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "preview_view",
        source: publicSource(),
        mode: "public",
        invoice_count: null,
        outcome: null,
      }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // Launch telemetry is diagnostic only and must never block the preview.
  }
}
