/**
 * Client-side Sentry — init only when VITE_SENTRY_DSN is set.
 * Safe no-ops when DSN is missing so local/dev boots without config.
 */
import * as Sentry from "@sentry/react";

const dsn = typeof import.meta !== "undefined" ? import.meta.env?.VITE_SENTRY_DSN : "";
let initialized = false;

export function initSentry() {
  if (initialized || !dsn || typeof dsn !== "string" || !dsn.trim()) return;
  try {
    Sentry.init({
      dsn: dsn.trim(),
      environment: import.meta.env?.MODE || "development",
      tracesSampleRate: 0.1,
    });
    initialized = true;
  } catch (err) {
    console.error("[sentry] init failed", err);
  }
}

export function captureException(error, context) {
  if (!initialized) return;
  try {
    if (context) {
      Sentry.withScope((scope) => {
        if (context.tags) {
          Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, String(v)));
        }
        if (context.extra) scope.setExtras(context.extra);
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch {
    /* never break the app for telemetry */
  }
}

export function captureMessage(message, level = "info") {
  if (!initialized) return;
  try {
    Sentry.captureMessage(message, level);
  } catch {
    /* ignore */
  }
}
