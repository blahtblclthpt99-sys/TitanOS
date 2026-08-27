const API_PREFIX = "/api/";
const EDGE_HEALTH_PATH = "/__titanos/edge-health";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; frame-src 'none'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io; worker-src 'self' blob:; upgrade-insecure-requests",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self), payment=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function applySecurityHeaders(headers) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}

function withSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);

  if (pathname.startsWith("/assets/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (pathname === "/sw.js") {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    headers.set("Service-Worker-Allowed", "/");
  } else if (pathname === "/manifest.webmanifest") {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    headers.set("Content-Type", "application/manifest+json");
  } else if (pathname === "/" || pathname.endsWith(".html")) {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function edgeHealthResponse(env) {
  const legacyOrigin = normalizeOrigin(env.LEGACY_API_ORIGIN);
  return Response.json(
    {
      ok: true,
      service: "titanos-edge",
      runtime: "cloudflare-workers",
      api_bridge_configured: Boolean(legacyOrigin),
    },
    {
      status: legacyOrigin ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-TitanOS-Edge": "cloudflare",
      },
    },
  );
}

function rewriteLegacyRedirect(location, legacyOrigin, incomingOrigin) {
  if (!location) return null;

  try {
    const target = new URL(location, legacyOrigin);
    if (target.origin !== legacyOrigin) return location;

    const rewritten = new URL(target.pathname + target.search + target.hash, incomingOrigin);
    return rewritten.toString();
  } catch {
    return location;
  }
}

async function proxyLegacyApi(request, env) {
  const legacyOrigin = normalizeOrigin(env.LEGACY_API_ORIGIN);
  if (!legacyOrigin) {
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-TitanOS-Edge": "cloudflare",
    });
    applySecurityHeaders(headers);

    return Response.json(
      { error: "TitanOS API migration origin is not configured" },
      { status: 503, headers },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, legacyOrigin);
  const headers = new Headers(request.headers);
  const requestId = headers.get("x-titanos-request-id") || crypto.randomUUID();

  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-titanos-edge", "cloudflare");
  headers.set("x-titanos-request-id", requestId);
  headers.delete("host");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const response = await fetch(target, init);
  const outgoing = new Headers(response.headers);
  outgoing.set("x-titanos-edge", "cloudflare");
  outgoing.set("x-titanos-request-id", requestId);
  outgoing.set("Cache-Control", "no-store");
  applySecurityHeaders(outgoing);

  const location = rewriteLegacyRedirect(
    outgoing.get("Location"),
    legacyOrigin,
    incoming.origin,
  );
  if (location) outgoing.set("Location", location);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outgoing,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === EDGE_HEALTH_PATH) {
      return edgeHealthResponse(env);
    }

    if (url.pathname === "/api" || url.pathname.startsWith(API_PREFIX)) {
      return proxyLegacyApi(request, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse, url.pathname);
  },
};
