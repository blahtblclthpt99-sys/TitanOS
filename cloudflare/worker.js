import { dispatchNativeApi } from "./api-router.js";

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

function applySecurityHeaders(headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
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

function isApiPath(pathname) {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

function secureApiResponse(response, requestId) {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-TitanOS-Request-Id", requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
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
          migration_mode: "full-app-native-staged",
          api_runtime: "cloudflare-workers-native",
          native_api_routes: 4,
          unmigrated_api_policy: "fail-closed",
          production_cutover_ready: false,
        },
        200,
        requestId,
      );
    }

    if (isApiPath(url.pathname)) {
      const apiResponse = await dispatchNativeApi(request, requestId);
      return secureApiResponse(apiResponse, requestId);
    }

    return serveAsset(request, env, requestId);
  },
};
