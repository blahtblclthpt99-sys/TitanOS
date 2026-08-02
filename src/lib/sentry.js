/**
 * Client Sentry — crashes, tracing, web vitals, privacy-masked session replay.
 * No-ops when VITE_SENTRY_DSN is unset.
 */
import * as Sentry from "@sentry/react";
import { envFlag, envString, isViteProd, readViteEnv } from "@/lib/viteEnv";
import { getObservabilityPrefs } from "@/lib/observabilityPrefs";

const dsn = envString("VITE_SENTRY_DSN");
let initialized = false;
let replayEnabled = false;

function isValidSentryDsn(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      Boolean(parsed.hostname) &&
      Boolean(parsed.username) &&
      parsed.pathname.split("/").filter(Boolean).length > 0
    );
  } catch {
    return false;
  }
}

function resolveRelease() {
  return (
    envString("VITE_SENTRY_RELEASE") ||
    envString("VITE_VERCEL_GIT_COMMIT_SHA") ||
    envString("VERCEL_GIT_COMMIT_SHA") ||
    undefined
  );
}

function resolveEnvironment() {
  return (
    envString("VITE_SENTRY_ENVIRONMENT") ||
    envString("VITE_VERCEL_ENV") ||
    envString("MODE", "development")
  );
}

function wantsReplay() {
  const prefs = getObservabilityPrefs();
  return Boolean(envFlag("VITE_SENTRY_REPLAY") && prefs.session_replay);
}

function buildIntegrations(withReplay) {
  const integrations = [
    Sentry.browserTracingIntegration(),
    Sentry.webVitalsIntegration({ reportAllChanges: false }),
  ];
  if (withReplay) {
    integrations.push(
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      })
    );
  }
  return integrations;
}

/**
 * Init crash + perf monitoring. Call once from main.jsx.
 * Replay is privacy-gated (env + user Privacy → session_replay).
 */
export function initSentry() {
  if (initialized || !dsn || !isValidSentryDsn(dsn)) return;
  try {
    const env = resolveEnvironment();
    const withReplay = wantsReplay();
    Sentry.init({
      dsn: dsn.trim(),
      environment: env,
      release: resolveRelease(),
      tracesSampleRate: env === "production" || isViteProd() ? 0.1 : 1.0,
      sendDefaultPii: false,
      integrations: buildIntegrations(withReplay),
      replaysSessionSampleRate: withReplay ? 0.05 : 0,
      replaysOnErrorSampleRate: withReplay ? 1.0 : 0,
      beforeSend(event) {
        // Extra scrub — never ship Authorization / cookies from breadcrumbs
        if (event.request?.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
          delete event.request.headers.Cookie;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
    replayEnabled = withReplay;
    initialized = true;
  } catch (err) {
    console.error("[sentry] init failed", err);
  }
}

/** Re-evaluate replay after Privacy prefs change (requires reload for full effect). */
export function syncSentryReplayPreference() {
  if (!initialized) {
    initSentry();
    return;
  }
  const next = wantsReplay();
  if (next !== replayEnabled && typeof window !== "undefined") {
    // Replay sample rates are fixed at init — soft signal only
    try {
      Sentry.setTag("session_replay_consent", next ? "on" : "off");
    } catch {
      /* */
    }
  }
}

export function isSentryInitialized() {
  return initialized;
}

export function isSessionReplayActive() {
  return initialized && replayEnabled;
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

/** Expose for tests / diagnostics without importing full SDK surface. */
export function getSentryDiagnostics() {
  const e = readViteEnv();
  return {
    initialized,
    replayEnabled,
    hasDsn: Boolean(dsn),
    environment: resolveEnvironment(),
    mode: e.MODE || null,
  };
}
