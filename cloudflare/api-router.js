import healthHandler from "../api/functions/health.js";
import authMeHandler from "../api/functions/auth/me.js";
import { invokeNodeHandler } from "./node-handler-adapter.js";

const ROUTES = new Map([
  ["/api/functions/health", healthHandler],
  ["/api/functions/auth/me", authMeHandler],
]);

function json(body, status, requestId) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-TitanOS-Request-Id": requestId,
      "X-TitanOS-API-Runtime": "cloudflare-workers-native",
    },
  });
}

export function hasNativeApiRoute(pathname) {
  return ROUTES.has(pathname);
}

export async function dispatchNativeApi(request, requestId) {
  const url = new URL(request.url);
  const handler = ROUTES.get(url.pathname);

  if (!handler) {
    return json(
      {
        ok: false,
        error: "api_route_not_migrated",
        message: "This TitanOS API route has not yet passed Cloudflare migration certification.",
      },
      503,
      requestId,
    );
  }

  try {
    return await invokeNodeHandler(handler, request, {
      "Cache-Control": "no-store",
      "X-TitanOS-Request-Id": requestId,
      "X-TitanOS-API-Runtime": "cloudflare-workers-native",
    });
  } catch (error) {
    console.error("TitanOS native API handler failed", {
      requestId,
      path: url.pathname,
      error: error instanceof Error ? error.message : String(error),
    });

    return json(
      {
        ok: false,
        error: "native_api_failure",
        message: "TitanOS API is temporarily unavailable.",
      },
      500,
      requestId,
    );
  }
}
