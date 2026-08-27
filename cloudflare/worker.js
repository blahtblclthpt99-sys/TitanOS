const API_PREFIX = "/api/";

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

async function proxyLegacyApi(request, env) {
  const origin = normalizeOrigin(env.LEGACY_API_ORIGIN);
  if (!origin) {
    return Response.json(
      { error: "TitanOS API migration origin is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, origin);
  const headers = new Headers(request.headers);

  // Preserve the public host/protocol explicitly for existing origin-aware handlers.
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  headers.set("x-titanos-edge", "cloudflare");
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
  outgoing.set("Cache-Control", outgoing.get("Cache-Control") || "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outgoing,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith(API_PREFIX)) {
      return proxyLegacyApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
