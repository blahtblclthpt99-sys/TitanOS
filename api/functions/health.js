import { applyCors, handleOptions } from "../_lib/cors.js";

/**
 * Lightweight readiness probe for load balancers and outage drills.
 * Does not expose secrets. Optional deep=1 checks Supabase reachability.
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
    supabaseConfigured: Boolean(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  };

  const deep = String(req.query?.deep || "").toLowerCase() === "1" ||
    String(new URL(req.url || "http://x", "http://x").searchParams.get("deep") || "") === "1";

  if (deep && checks.supabaseConfigured) {
    try {
      const { getSupabaseAdmin } = await import("../_lib/supabase.js");
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("profiles").select("id").limit(1);
      checks.supabase = error ? "degraded" : "ok";
      if (error) checks.supabaseError = error.message;
    } catch (err) {
      checks.supabase = "down";
      checks.supabaseError = err.message || "unreachable";
    }
  }

  const degraded = checks.supabase === "degraded" || checks.supabase === "down";
  const status = degraded ? 503 : 200;
  return res.status(status).json({
    status: degraded ? "degraded" : "ok",
    service: "titanos",
    latencyMs: Date.now() - started,
    checks,
    ts: new Date().toISOString(),
  });
}
