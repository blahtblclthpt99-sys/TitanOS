/**
 * Host-neutral server error reporting.
 *
 * The original implementation imported @sentry/node from the shared API path.
 * That works in Node serverless runtimes but forces Cloudflare Workers to bundle
 * Node-only networking internals. This helper keeps the same call-site contract
 * while sending a minimal Sentry envelope with standards-based fetch.
 *
 * api/instrument.mjs remains the optional Node-only tracing/profiling bootstrap
 * for Node deployments; it is intentionally not imported from this shared path.
 */

let pendingSentry = new Set();
export let sentryEnabled = false;

function envValue(name) {
  try {
    return String(process?.env?.[name] || "").trim();
  } catch {
    return "";
  }
}

function resolveDsn() {
  return envValue("SENTRY_DSN") || envValue("VITE_SENTRY_DSN");
}

function resolveEnvironment() {
  return (
    envValue("SENTRY_ENVIRONMENT") ||
    envValue("CF_PAGES_BRANCH") ||
    envValue("VERCEL_ENV") ||
    envValue("NODE_ENV") ||
    "production"
  );
}

function resolveRelease() {
  return (
    envValue("SENTRY_RELEASE") ||
    envValue("CF_PAGES_COMMIT_SHA") ||
    envValue("VERCEL_GIT_COMMIT_SHA") ||
    envValue("VERCEL_GIT_COMMIT_REF") ||
    undefined
  );
}

function refreshEnabled() {
  sentryEnabled = Boolean(resolveDsn());
  return sentryEnabled;
}

function parseDsn(dsn) {
  try {
    const url = new URL(dsn);
    if (url.protocol !== "https:" || !url.username || !url.hostname) return null;

    const segments = url.pathname.split("/").filter(Boolean);
    const projectId = segments.pop();
    if (!projectId || !/^\d+$/.test(projectId)) return null;

    const prefix = segments.length ? `/${segments.join("/")}` : "";
    return {
      dsn,
      endpoint: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

function eventId() {
  try {
    return crypto.randomUUID().replaceAll("-", "");
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(32, "0").slice(0, 32);
  }
}

function errorShape(error) {
  if (error instanceof Error) {
    return {
      type: String(error.name || "Error").slice(0, 120),
      value: String(error.message || "Unexpected server error").slice(0, 2000),
      stack: String(error.stack || "").slice(0, 12000),
    };
  }

  return {
    type: "Error",
    value: String(error || "Unexpected server error").slice(0, 2000),
    stack: "",
  };
}

function sendEnvelope(error, context = {}) {
  const dsn = resolveDsn();
  const parsed = dsn ? parseDsn(dsn) : null;
  sentryEnabled = Boolean(parsed);
  if (!parsed || typeof fetch !== "function") return null;

  const id = eventId();
  const shaped = errorShape(error);
  const now = new Date().toISOString();
  const tags = Object.fromEntries(
    Object.entries(context.tags || {}).map(([key, value]) => [String(key).slice(0, 64), String(value).slice(0, 200)])
  );

  const event = {
    event_id: id,
    timestamp: now,
    platform: "javascript",
    level: "error",
    environment: resolveEnvironment(),
    release: resolveRelease(),
    exception: {
      values: [
        {
          type: shaped.type,
          value: shaped.value,
        },
      ],
    },
    tags,
    extra: {
      ...(context.extra || {}),
      ...(shaped.stack ? { stack: shaped.stack } : {}),
      runtime: "titan-api",
    },
  };

  const body = [
    JSON.stringify({ event_id: id, sent_at: now, dsn: parsed.dsn }),
    JSON.stringify({ type: "event", content_type: "application/json" }),
    JSON.stringify(event),
  ].join("\n");

  const promise = fetch(parsed.endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body,
  })
    .then((response) => response.ok)
    .catch(() => false);

  pendingSentry.add(promise);
  void promise.finally(() => pendingSentry.delete(promise));
  return id;
}

/** @deprecated Kept for call-site compatibility. */
export function initApiSentry() {
  return refreshEnabled();
}

export function isApiSentryEnabled() {
  return refreshEnabled();
}

/** Native Node profiling is intentionally not part of the Cloudflare-safe path. */
export function isApiSentryProfilingEnabled() {
  return false;
}

/**
 * Capture an API exception without importing Node-only telemetry dependencies.
 * @param {unknown} error
 * @param {{ tags?: Record<string, string>, extra?: Record<string, unknown> }} [context]
 */
export function captureApiException(error, context) {
  try {
    sendEnvelope(error, context || {});
  } catch {
    /* never fail the request for telemetry */
  }
}

/**
 * Minimal compatibility facade for older server call sites.
 * New API code should call captureApiException directly.
 */
export const Sentry = {
  captureException(error) {
    return sendEnvelope(error, {});
  },
  withScope(callback) {
    const scopeState = { tags: {}, extra: {} };
    const scope = {
      setTag(key, value) {
        scopeState.tags[String(key)] = String(value);
      },
      setTags(values = {}) {
        Object.assign(scopeState.tags, values);
      },
      setExtra(key, value) {
        scopeState.extra[String(key)] = value;
      },
      setExtras(values = {}) {
        Object.assign(scopeState.extra, values);
      },
    };
    return callback(scope);
  },
  async flush(timeoutMs = 2000) {
    const tasks = [...pendingSentry];
    if (!tasks.length) return true;
    const timeout = new Promise((resolve) => setTimeout(() => resolve(false), Math.max(0, Number(timeoutMs) || 0)));
    const settled = Promise.allSettled(tasks).then(() => true);
    return Promise.race([settled, timeout]);
  },
};
