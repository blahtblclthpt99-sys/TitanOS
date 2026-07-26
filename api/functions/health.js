import { applyCors, handleOptions } from "../_lib/cors.js";

/**
 * Liveness + readiness probe for load balancers and outage drills.
 * Does not expose secrets.
 *
 * - Default: config presence checks (always 200 if process is up)
 * - ?deep=1: live Supabase query + optional Stripe balance ping
 * - readiness.ok=false when money path is incomplete (visible, not silent)
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
    mppConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    mppProfileConfigured: Boolean(
      process.env.STRIPE_PROFILE_ID &&
        /^profile_[A-Za-z0-9_]+$/.test(String(process.env.STRIPE_PROFILE_ID).trim())
    ),
  };

  const deep =
    String(req.query?.deep || "").toLowerCase() === "1" ||
    String(new URL(req.url || "http://x", "http://x").searchParams.get("deep") || "") === "1";

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
  }

  const moneyReady =
    checks.supabaseConfigured &&
    ((checks.stripeConfigured && checks.webhookConfigured) || checks.paypalConfigured);
  const deepFail =
    checks.supabase === "degraded" ||
    checks.supabase === "down" ||
    checks.stripe === "degraded" ||
    checks.stripe === "down";

  const readiness = {
    ok: moneyReady && !deepFail,
    moneyPath: moneyReady ? "ready" : "incomplete",
    notes: moneyReady
      ? undefined
      : "Need Supabase service role plus (Stripe secret+webhook) and/or (PayPal client+secret+webhook id).",
  };

  // Liveness stays 200 unless deep dependency is down; readiness is explicit in body.
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
