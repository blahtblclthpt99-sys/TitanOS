/**
 * Sentry Node.js instrument — load before other app modules.
 * Per https://skills.sentry.dev/instrument (Node SDK recommended defaults).
 *
 * Vercel serverless: imported via api/_lib/sentry.js so handlers that use
 * captureApiException initialize Sentry on cold start.
 */
import * as Sentry from "@sentry/node";
import { createRequire } from "node:module";
import { normalizeSentryDsn } from "../src/lib/sentryDsn.js";

const require = createRequire(import.meta.url);

function resolveDsn() {
  const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || "";
  return normalizeSentryDsn(dsn);
}

function resolveEnvironment() {
  return (
    process.env.SENTRY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development"
  );
}

function resolveRelease() {
  return (
    process.env.SENTRY_RELEASE ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    undefined
  );
}

function isDevLike() {
  const env = resolveEnvironment();
  return env === "development" || env === "preview" || process.env.NODE_ENV === "development";
}

const dsn = resolveDsn();
export const sentryEnabled = Boolean(dsn);

let profilingLoaded = false;
const integrations = [];

if (sentryEnabled) {
  // Opt-in: native profiler can be heavy / unavailable on some hosts (set SENTRY_PROFILING=1)
  if (String(process.env.SENTRY_PROFILING || "") === "1") {
    try {
      const { nodeProfilingIntegration } = require("@sentry/profiling-node");
      integrations.push(nodeProfilingIntegration());
      profilingLoaded = true;
    } catch (err) {
      console.warn(
        "[sentry:api] @sentry/profiling-node unavailable — continuing without profiling:",
        err?.message || err
      );
    }
  }

  Sentry.init({
    dsn,
    environment: resolveEnvironment(),
    release: resolveRelease(),

    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment:
      // userInfo: false,
      // httpBodies: [],
    },

    // Recommended baseline: errors + tracing
    tracesSampleRate: isDevLike() ? 1.0 : 0.1,
    includeLocalVariables: true,
    enableLogs: true,

    integrations,

    // Profiling (requires tracing). Session sample decided once per process.
    ...(profilingLoaded
      ? {
          profileSessionSampleRate: isDevLike() ? 1.0 : 0.1,
          profileLifecycle: "trace",
        }
      : {}),
  });
}

export { Sentry };
export function getSentryProfilingEnabled() {
  return profilingLoaded;
}
