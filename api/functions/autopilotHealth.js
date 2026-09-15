import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertSupabaseProjectConsistency } from "../_lib/supabase.js";

function configured(value) {
  return Boolean(String(value || "").trim());
}

function surfaceIsTitanOS() {
  const surface = String(
    process.env.VITE_APP_SURFACE ||
    process.env.TITAN_PRODUCT_SURFACE ||
    "titanos"
  ).trim().toLowerCase();
  return ["titanos", "autopilot", "titan_os"].includes(surface);
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let supabaseConsistent = false;
  try {
    assertSupabaseProjectConsistency();
    supabaseConsistent = true;
  } catch {
    supabaseConsistent = false;
  }

  const checks = {
    titanSurface: surfaceIsTitanOS(),
    supabaseServerUrl: configured(process.env.SUPABASE_URL),
    supabaseClientUrl: configured(process.env.VITE_SUPABASE_URL),
    supabaseServiceRole: configured(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseConsistent,
    resendApiKey: configured(process.env.RESEND_API_KEY),
    resendFrom: configured(process.env.RESEND_FROM),
  };

  const ready = Object.values(checks).every(Boolean);
  res.setHeader("Cache-Control", "no-store");
  return res.status(ready ? 200 : 503).json({
    product: "titan-autopilot",
    mode: "free",
    ready,
    checks,
  });
}
