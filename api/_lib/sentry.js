/**
 * Server-side Sentry helpers for Vercel serverless functions.
 * Init lives in api/instrument.mjs (errors + tracing + optional profiling).
 */
import { Sentry, sentryEnabled, getSentryProfilingEnabled } from "../instrument.mjs";

/** @deprecated Prefer side-effect of importing this module; kept for call-site compat. */
export function initApiSentry() {
  return sentryEnabled;
}

export function isApiSentryEnabled() {
  return sentryEnabled;
}

export function isApiSentryProfilingEnabled() {
  return getSentryProfilingEnabled();
}

/**
 * Capture an API exception. No-ops when DSN is unset.
 * Flushes the client so short-lived serverless invocations still deliver events.
 * @param {unknown} error
 * @param {{ tags?: Record<string, string>, extra?: Record<string, unknown> }} [context]
 */
export function captureApiException(error, context) {
  if (!sentryEnabled) return;
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
    // Serverless: flush without blocking the response path excessively
    void Sentry.flush(2000).catch(() => {});
  } catch {
    /* never fail the request for telemetry */
  }
}

export { Sentry };
