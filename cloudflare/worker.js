const EDGE_HEALTH_PATH = "/__titanos/edge-health";
const API_PREFIX = "/api";

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://api.stripe.com",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; "),
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self), payment=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
});

function requestIdFor(request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  if (supplied && supplied.length <= 128) return supplied;
  return crypto.randomUUID();
}

function jsonResponse(body, status, requestId) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-TitanOS-Request-Id": requestId,
  });
  applySecurityHeaders(headers);
  return new Response(JSON.stringify(body), { status, headers });
}

function applySecurityHeaders(headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

function parseLegacyOrigin(env) {
  const raw = env.LEGACY_API_ORIGIN?.trim();
  if (!raw) return null;

  let origin;
  try {
    origin = new URL(raw);
  } catch {
    return null;
  }

  if (origin.protocol !== "https:") return null;
  if (origin.username || origin.password || origin.search || origin.hash) return null;
  if (origin.pathname !== "/" && origin.pathname !== "") return null;
  return origin.origin;
}

function isApiPath(pathname) {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

function rewriteLegacyLocation(location, legacyOrigin, edgeOrigin) {
  if (!location) return location;

  try {
    const resolved = new URL(location, legacyOrigin);
    if (resolved.origin !== legacyOrigin) return location;
    return `${edgeOrigin}${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return location;
  }
}

async function proxyLegacyApi(request, env, requestId) {
  const legacyOrigin = parseLegacyOrigin(env);
  if (!legacyOrigin) {
    return jsonResponse(
      {
        ok: false,
        error: "legacy_api_origin_not_configured",
        message: "TitanOS API compatibility bridge is unavailable.",
      },
      503,
      requestId,
    );
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, legacyOrigin);
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-titanos-edge-runtime", "cloudflare-workers");
  headers.set("x-titanos-request-id", requestId);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (error) {
    console.error("TitanOS legacy API bridge fetch failed", {
      requestId,
      path: incomingUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      {
        ok: false,
        error: "legacy_api_unavailable",
        message: "TitanOS API is temporarily unavailable.",
      },
      502,
      requestId,
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-TitanOS-Request-Id", requestId);
  responseHeaders.set("X-TitanOS-API-Runtime", "legacy-bridge");
  applySecurityHeaders(responseHeaders);

  const location = responseHeaders.get("Location");
  if (location) {
    responseHeaders.set(
      "Location",
      rewriteLegacyLocation(location, legacyOrigin, incomingUrl.origin),
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

async function serveAsset(request, env, requestId) {
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  const url = new URL(request.url);

  applySecurityHeaders(headers);
  headers.set("X-TitanOS-Request-Id", requestId);
  headers.set("X-TitanOS-Edge-Runtime", "cloudflare-workers");

  if (url.pathname.startsWith("/assets/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (
    url.pathname === "/sw.js" ||
    url.pathname === "/manifest.webmanifest" ||
    response.headers.get("content-type")?.includes("text/html")
  ) {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }

  if (url.pathname === "/sw.js") {
    headers.set("Service-Worker-Allowed", "/");
  }
  if (url.pathname === "/manifest.webmanifest") {
    headers.set("Content-Type", "application/manifest+json");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestId = requestIdFor(request);

    if (url.pathname === EDGE_HEALTH_PATH) {
      return jsonResponse(
        {
          ok: true,
          service: "titanos-edge",
          runtime: "cloudflare-workers",
          migration_mode: "full-app-strangler",
          api_runtime: "legacy-bridge",
          legacy_api_configured: Boolean(parseLegacyOrigin(env)),
          production_cutover_ready: false,
        },
        200,
        requestId,
      );
    }

    if (isApiPath(url.pathname)) {
      return proxyLegacyApi(request, env, requestId);
    }

    return serveAsset(request, env, requestId);
  },
};
