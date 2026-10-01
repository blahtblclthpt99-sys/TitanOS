/**
 * Production failure alerting — posts to OPS_ALERT_WEBHOOK_URL or SLACK_WEBHOOK_URL.
 * Rate-limited in-process so a storm does not fan out.
 */
import { logWarn, redactValue } from "./safeLog.js";

const recent = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_KEY = 3;

function shouldSend(key) {
  const now = Date.now();
  const row = recent.get(key) || { t: now, n: 0 };
  if (now - row.t > WINDOW_MS) {
    row.t = now;
    row.n = 0;
  }
  row.n += 1;
  recent.set(key, row);
  return row.n <= MAX_PER_KEY;
}

function webhookUrl() {
  return (
    String(process.env.OPS_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || "").trim() || null
  );
}

/**
 * @param {{
 *   title: string,
 *   severity?: "critical"|"high"|"medium",
 *   route?: string,
 *   requestId?: string,
 *   category?: string,
 *   detail?: string,
 * }} payload
 */
export async function alertProductionFailure(payload) {
  const url = webhookUrl();
  if (!url) return { sent: false, reason: "no_webhook" };

  const env = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production";
  if (env === "development" && String(process.env.OPS_ALERT_IN_DEV || "") !== "1") {
    return { sent: false, reason: "dev_skip" };
  }

  const severity = payload.severity || "high";
  const key = `${severity}:${payload.route || "api"}:${payload.title || "fail"}`;
  if (!shouldSend(key)) {
    logWarn("ops-alert", "rate_limited", { key });
    return { sent: false, reason: "rate_limited" };
  }

  const text = [
    `*[TitanOS ${severity}]* ${payload.title || "Production failure"}`,
    payload.route ? `route=\`${payload.route}\`` : null,
    payload.category ? `category=\`${payload.category}\`` : null,
    payload.requestId ? `requestId=\`${payload.requestId}\`` : null,
    payload.detail ? String(payload.detail).slice(0, 280) : null,
    `env=\`${env}\``,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        // Slack-compatible; Discord ignores unknown fields
        content: text,
        ...redactValue({
          blocks: undefined,
        }),
      }),
    });
    if (!res.ok) {
      logWarn("ops-alert", `webhook_http_${res.status}`);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    logWarn("ops-alert", err?.message || "webhook_failed");
    return { sent: false, reason: "fetch_failed" };
  }
}

export function isOpsAlertConfigured() {
  return Boolean(webhookUrl());
}
