/**
 * Server-side Sentry for Vercel serverless functions.
 * Init when SENTRY_DSN or VITE_SENTRY_DSN is set.
 */
import * as Sentry from "@sentry/node";

let initialized = false;

function resolveDsn() {
  const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || "";
  return typeof dsn === "string" ? dsn.trim() : "";
}

export function initApiSentry() {
  if (initialized) return;
  const dsn = resolveDsn();
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      tracesSampleRate: 0.05,
    });
    initialized = true;
  } catch (err) {
    console.error("[sentry:api] init failed", err?.message || err);
  }
}

/**
 * Capture an API exception. No-ops when DSN is unset.
 * @param {unknown} error
 * @param {{ tags?: Record<string, string>, extra?: Record<string, unknown> }} [context]
 */
export function captureApiException(error, context) {
  initApiSentry();
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
    /* never fail the request for telemetry */
  }
}
