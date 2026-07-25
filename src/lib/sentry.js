/**
 * Client-side Sentry — init only when VITE_SENTRY_DSN is set.
 * Safe no-ops when DSN is missing so local/dev boots without config.
 *
 * Does not attach emails/PII beyond opaque user id. Clear on logout.
 */
import * as Sentry from "@sentry/react";

const dsn = typeof import.meta !== "undefined" ? import.meta.env?.VITE_SENTRY_DSN : "";
let initialized = false;

function resolveRelease() {
  return (
    import.meta.env?.VITE_SENTRY_RELEASE ||
    import.meta.env?.VITE_VERCEL_GIT_COMMIT_SHA ||
    import.meta.env?.VERCEL_GIT_COMMIT_SHA ||
    undefined
  );
}

function resolveEnvironment() {
  return (
    import.meta.env?.VITE_SENTRY_ENVIRONMENT ||
    import.meta.env?.VITE_VERCEL_ENV ||
    import.meta.env?.MODE ||
    "development"
  );
}

export function initSentry() {
  if (initialized || !dsn || typeof dsn !== "string" || !dsn.trim()) return;
  try {
    Sentry.init({
      dsn: dsn.trim(),
      environment: resolveEnvironment(),
      release: resolveRelease(),
      tracesSampleRate: resolveEnvironment() === "production" ? 0.1 : 1.0,
      sendDefaultPii: false,
    });
    initialized = true;
  } catch (err) {
    console.error("[sentry] init failed", err);
  }
}

export function isSentryInitialized() {
  return initialized;
}

/** Attach opaque user id only — never password, tokens, or full profile dumps. */
export function setSentryUser(user) {
  if (!initialized) return;
  try {
    if (!user?.id) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({
      id: String(user.id),
      // username only if already public-facing; omit email by default
      username: user.username ? String(user.username).slice(0, 64) : undefined,
    });
  } catch {
    /* ignore */
  }
}

export function clearSentryUser() {
  if (!initialized) return;
  try {
    Sentry.setUser(null);
  } catch {
    /* ignore */
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
