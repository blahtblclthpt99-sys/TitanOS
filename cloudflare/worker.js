import genericStripeWebhook from "../api/functions/stripeWebhook.js";
import {
  createAttentionCheckout,
  handleAttentionStripeWebhook,
} from "./attention-api.js";
import {
  getActiveFunctionHandler,
  getActiveTopLevelApiHandler,
} from "./active-function-registry.js";
import { runNodeHandler } from "./node-handler-adapter.js";

const EDGE_HEALTH_PATH = "/__titanos/edge-health";
const CHECKOUT_PATH = "/api/attention/create-checkout";
const ATTENTION_STRIPE_WEBHOOK_PATH = "/api/attention/stripe-webhook";
const GENERIC_STRIPE_WEBHOOK_PATH = "/api/functions/stripeWebhook";
const FUNCTION_PATH_PREFIX = "/api/functions/";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; frame-src 'none'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io; worker-src 'self' blob:; upgrade-insecure-requests",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self), payment=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function applySecurityHeaders(headers) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}

function secureResponse(response, pathname) {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);
  headers.set("X-TitanOS-Edge", "cloudflare");

  if (pathname.startsWith("/api/") || pathname.startsWith("/__titanos/")) {
    headers.set("Cache-Control", "no-store");
  } else if (pathname.startsWith("/assets/")) {
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

function cleanHttpsOrigin(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/"
    ) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

function bindingConfigured(value) {
  return Boolean(String(value || "").trim());
}

function appOriginConfigured(env) {
  return Boolean(cleanHttpsOrigin(env.APP_ORIGIN));
}

function corePaymentBindingsConfigured(env) {
  return Boolean(
    bindingConfigured(env.STRIPE_SECRET_KEY) &&
    bindingConfigured(env.STRIPE_WEBHOOK_SECRET) &&
    bindingConfigured(env.SUPABASE_URL) &&
    bindingConfigured(env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

function attentionPaymentBindingsConfigured(env) {
  return Boolean(
    bindingConfigured(env.STRIPE_SECRET_KEY) &&
    bindingConfigured(env.ATTENTION_STRIPE_WEBHOOK_SECRET) &&
    bindingConfigured(env.SUPABASE_URL) &&
    bindingConfigured(env.SUPABASE_SERVICE_ROLE_KEY) &&
    appOriginConfigured(env)
  );
}

function webhookSigningSecretsDistinct(env) {
  const coreWebhookSecret = String(env.STRIPE_WEBHOOK_SECRET || "").trim();
  const attentionWebhookSecret = String(env.ATTENTION_STRIPE_WEBHOOK_SECRET || "").trim();
  return Boolean(
    coreWebhookSecret &&
    attentionWebhookSecret &&
    coreWebhookSecret !== attentionWebhookSecret
  );
}

function paymentBindingsConfigured(env) {
  return Boolean(
    corePaymentBindingsConfigured(env) &&
    attentionPaymentBindingsConfigured(env) &&
    webhookSigningSecretsDistinct(env)
  );
}

function attentionCheckoutBindings(env) {
  return {
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    APP_ORIGIN: env.APP_ORIGIN,
  };
}

function attentionWebhookBindings(env) {
  return {
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.ATTENTION_STRIPE_WEBHOOK_SECRET,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function edgeHealthResponse(env) {
  const version = env.CF_VERSION_METADATA || {};
  return Response.json(
    {
      ok: true,
      service: "titanos-edge",
      runtime: "cloudflare-workers",
      api_runtime: "cloudflare-workers",
      legacy_proxy: false,
      app_origin_configured: appOriginConfigured(env),
      core_payment_bindings_configured: corePaymentBindingsConfigured(env),
      attention_payment_bindings_configured: attentionPaymentBindingsConfigured(env),
      webhook_signing_secrets_distinct: webhookSigningSecretsDistinct(env),
      payment_bindings_configured: paymentBindingsConfigured(env),
      worker_version_id: version.id || null,
      worker_version_tag: version.tag || null,
      worker_version_timestamp: version.timestamp || null,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-TitanOS-Edge": "cloudflare",
      },
    },
  );
}

function apiNotFound() {
  return Response.json(
    { error: "API route not found" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

function activeFunctionHandler(pathname) {
  if (!pathname.startsWith(FUNCTION_PATH_PREFIX)) return null;
  const name = pathname.slice(FUNCTION_PATH_PREFIX.length);
  if (!name || name.includes("/")) return null;
  return getActiveFunctionHandler(name);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response;

    if (url.pathname === EDGE_HEALTH_PATH) {
      response = edgeHealthResponse(env);
    } else if (url.pathname === CHECKOUT_PATH) {
      response = await createAttentionCheckout(request, attentionCheckoutBindings(env));
    } else if (url.pathname === ATTENTION_STRIPE_WEBHOOK_PATH) {
      response = await handleAttentionStripeWebhook(request, attentionWebhookBindings(env));
    } else if (url.pathname === GENERIC_STRIPE_WEBHOOK_PATH) {
      response = await runNodeHandler(genericStripeWebhook, request);
    } else {
      const handler = activeFunctionHandler(url.pathname) || getActiveTopLevelApiHandler(url.pathname);
      if (handler) {
        response = await runNodeHandler(handler, request);
      } else if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        response = apiNotFound();
      } else {
        response = await env.ASSETS.fetch(request);
      }
    }

    return secureResponse(response, url.pathname);
  },
};
