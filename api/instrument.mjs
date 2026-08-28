/**
 * TitanOS server-side Sentry bootstrap.
 *
 * This module is bundled into Cloudflare Workers as canonical API handlers are
 * migrated. Keep it free of Node-native profiler/bootstrap assumptions that
 * Cloudflare cannot validate at upload time.
 */
import * as Sentry from "@sentry/node";

function resolveDsn() {
  const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || "";
  return typeof dsn === "string" ? dsn.trim() : "";
}

function resolveEnvironment() {
  return (
    process.env.SENTRY_ENVIRONMENT ||
    process.env.TITANOS_ENV ||
    process.env.DEPLOYMENT_ENV ||
    process.env.ENVIRONMENT ||
    process.env.NODE_ENV ||
    "development"
  );
}

function resolveRelease() {
  return (
    process.env.SENTRY_RELEASE ||
    process.env.CF_VERSION_METADATA_ID ||
    process.env.GITHUB_SHA ||
    undefined
  );
}

function isDevLike() {
  const env = resolveEnvironment();
  return env === "development" || env === "preview" || process.env.NODE_ENV === "development";
}

const dsn = resolveDsn();
export const sentryEnabled = Boolean(dsn);

// Native Node CPU profiling machinery is intentionally excluded from the
// Worker bundle. Error reporting/tracing remain enabled; Worker profiling can
// be added later with a Cloudflare-native integration.
const profilingLoaded = false;

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: resolveEnvironment(),
    release: resolveRelease(),

    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment:
      // userInfo: false,
      // httpBodies: [],
    },

    tracesSampleRate: isDevLike() ? 1.0 : 0.1,
    includeLocalVariables: true,
    enableLogs: true,
    integrations: [],
  });
}

export { Sentry };
export function getSentryProfilingEnabled() {
  return profilingLoaded;
}
