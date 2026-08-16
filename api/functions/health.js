import { applyCors, handleOptions } from "../_lib/cors.js";
import { secretsEqual } from "../_lib/secureCompare.js";
import { stripePlanCatalog } from "../_lib/stripeSubscriptions.js";

const EXPECTED_SUBSCRIPTION_PRICES = Object.freeze({
  starter: { unitAmount: 499, currency: "usd", interval: "month" },
  worker_premium: { unitAmount: 999, currency: "usd", interval: "month" },
  business: { unitAmount: 1999, currency: "usd", interval: "month" },
});

function subscriptionCatalogConfigured() {
  const catalog = stripePlanCatalog();
  return Object.keys(EXPECTED_SUBSCRIPTION_PRICES).every((plan) => Boolean(catalog[plan]));
}

async function validateStripeSubscriptionCatalog(stripeKey) {
  const catalog = stripePlanCatalog();
  const checks = {};
  for (const [plan, expected] of Object.entries(EXPECTED_SUBSCRIPTION_PRICES)) {
    const priceId = catalog[plan];
    if (!priceId) {
      checks[plan] = "missing";
      continue;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(
        `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${stripeKey}` },
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        checks[plan] = `http_${response.status}`;
        continue;
      }

      const price = await response.json();
      const productPlan = price?.product?.metadata?.plan_id || null;
      const valid =
        price?.active === true &&
        price?.livemode === true &&
        price?.type === "recurring" &&
        price?.recurring?.interval === expected.interval &&
        price?.currency === expected.currency &&
        Number(price?.unit_amount) === expected.unitAmount &&
        productPlan === plan;
      checks[plan] = valid ? "ok" : "mismatch";
    } catch {
      checks[plan] = "unreachable";
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: Object.values(checks).every((status) => status === "ok"),
    plans: checks,
  };
}

/**
 * Liveness + readiness probe for load balancers and outage drills.
 * Does not expose secrets or configured Stripe price IDs.
 *
 * - Default: config presence checks (always 200 if process is up)
 * - ?deep=1: live Supabase + Stripe balance/catalog verification
 *   (requires header x-titanos-ops: HEALTH_DEEP_SECRET or TITANOS_OPS_SECRET)
 * - readiness.ok=false when a required money/subscription path is incomplete
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const started = Date.now();
  const checks = {
    api: "ok",
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripeSubscriptionPricesConfigured: subscriptionCatalogConfigured(),
    paypalConfigured: Boolean(
      process.env.PAYPAL_CLIENT_ID &&
        process.env.PAYPAL_CLIENT_SECRET &&
        process.env.PAYPAL_WEBHOOK_ID
    ),
    supabaseConfigured: Boolean(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    sentryConfigured: Boolean(process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN),
    opsAlertConfigured: Boolean(
      process.env.OPS_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL
    ),
    analyticsIngestEnabled: String(process.env.ANALYTICS_INGEST_ENABLED || "") === "1",
    mppConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    mppProfileConfigured: Boolean(
      process.env.STRIPE_PROFILE_ID &&
        /^profile_[A-Za-z0-9_]+$/.test(String(process.env.STRIPE_PROFILE_ID).trim())
    ),
    mppTestnet: String(process.env.MPP_TESTNET || "1") !== "0",
  };

  const deep =
    String(req.query?.deep || "").toLowerCase() === "1" ||
    String(new URL(req.url || "http://x", "http://x").searchParams.get("deep") || "") === "1";

  if (deep) {
    const opsSecret = process.env.HEALTH_DEEP_SECRET || process.env.TITANOS_OPS_SECRET;
    const provided = req.headers["x-titanos-ops"] || req.headers["x-health-deep"];
    if (!opsSecret || !secretsEqual(opsSecret, provided)) {
      return res.status(401).json({
        error: "Deep health requires x-titanos-ops header matching HEALTH_DEEP_SECRET",
      });
    }
  }

  if (deep && checks.supabaseConfigured) {
    try {
      const { getSupabaseAdmin } = await import("../_lib/supabase.js");
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("profiles").select("id").limit(1);
      checks.supabase = error ? "degraded" : "ok";
      if (error) checks.supabaseError = "query_failed";
    } catch {
      checks.supabase = "down";
      checks.supabaseError = "unreachable";
    }
  }

  if (deep && checks.stripeConfigured) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const stripeRes = await fetch("https://api.stripe.com/v1/balance", {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      checks.stripe = stripeRes.ok ? "ok" : "degraded";
      if (!stripeRes.ok) checks.stripeError = `http_${stripeRes.status}`;
    } catch {
      checks.stripe = "down";
      checks.stripeError = "unreachable";
    }

    if (checks.stripeSubscriptionPricesConfigured) {
      const catalog = await validateStripeSubscriptionCatalog(process.env.STRIPE_SECRET_KEY);
      checks.stripeSubscriptionCatalog = catalog.ok ? "ok" : "degraded";
      checks.stripeSubscriptionPlans = catalog.plans;
    } else {
      checks.stripeSubscriptionCatalog = "incomplete";
    }
  }

  const moneyReady =
    checks.supabaseConfigured &&
    ((checks.stripeConfigured && checks.webhookConfigured) || checks.paypalConfigured);
  const subscriptionReady =
    checks.stripeConfigured && checks.webhookConfigured && checks.stripeSubscriptionPricesConfigured;
  const deepFail =
    checks.supabase === "degraded" ||
    checks.supabase === "down" ||
    checks.stripe === "degraded" ||
    checks.stripe === "down" ||
    checks.stripeSubscriptionCatalog === "degraded" ||
    checks.stripeSubscriptionCatalog === "incomplete";

  const readiness = {
    ok: moneyReady && subscriptionReady && !deepFail,
    moneyPath: moneyReady ? "ready" : "incomplete",
    subscriptionBilling: subscriptionReady ? "ready" : "incomplete",
    observability: {
      sentry: checks.sentryConfigured ? "configured" : "missing_dsn",
      opsAlert: checks.opsAlertConfigured ? "configured" : "missing_webhook",
      analyticsIngest: checks.analyticsIngestEnabled ? "on" : "off",
    },
    notes:
      moneyReady && subscriptionReady
        ? undefined
        : "Need Supabase service role, Stripe secret+webhook, and all three active subscription price mappings (or PayPal for non-subscription money paths).",
  };

  const status = deep && deepFail ? 503 : 200;
  return res.status(status).json({
    status: deep && deepFail ? "degraded" : "ok",
    service: "titanos",
    latencyMs: Date.now() - started,
    checks,
    readiness,
    ts: new Date().toISOString(),
  });
}
