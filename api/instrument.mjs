/**
 * TitanOS server-side Sentry instrument.
 * Kept runtime-portable for Cloudflare Workers: error capture + tracing only.
 * Native Node CPU profiling is intentionally disabled at the edge.
 */
import * as Sentry from "@sentry/node";

function resolveDsn() {
  const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || "";
  return typeof dsn === "string" ? dsn.trim() : "";
}

function resolveEnvironment() {
  return (
    process.env.SENTRY_ENVIRONMENT ||
    process.env.CLOUDFLARE_ENV ||
    process.env.NODE_ENV ||
    "development"
  );
}

function resolveRelease() {
  return process.env.SENTRY_RELEASE || process.env.GITHUB_SHA || undefined;
}

function isDevLike() {
  const env = resolveEnvironment();
  return env === "development" || env === "preview" || process.env.NODE_ENV === "development";
}

const dsn = resolveDsn();
export const sentryEnabled = Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: resolveEnvironment(),
    release: resolveRelease(),
    dataCollection: {
      // Keep request/user PII opt-in rather than implicit.
    },
    tracesSampleRate: isDevLike() ? 1.0 : 0.1,
    includeLocalVariables: false,
    enableLogs: true,
  });
}

export { Sentry };
export function getSentryProfilingEnabled() {
  return false;
}
