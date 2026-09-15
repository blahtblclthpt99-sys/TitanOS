import { applyCors, handleOptions } from "../_lib/cors.js";
import {
  assertSupabaseProjectConsistency,
  getSupabaseAdmin,
} from "../_lib/supabase.js";

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

async function probeTable(admin, table, column = "id") {
  try {
    const { error } = await admin.from(table).select(column).limit(1);
    return !error;
  } catch {
    return false;
  }
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

  const staticChecks = {
    titanSurface: surfaceIsTitanOS(),
    supabaseServerUrl: configured(process.env.SUPABASE_URL),
    supabaseClientUrl: configured(process.env.VITE_SUPABASE_URL),
    supabaseServiceRole: configured(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseConsistent,
    resendApiKey: configured(process.env.RESEND_API_KEY),
    resendFrom: configured(process.env.RESEND_FROM),
  };

  let databaseChecks = {
    databaseReachable: false,
    autopilotRuns: false,
    recoveryReceipts: false,
    invoices: false,
    deliveryGuards: false,
  };

  if (
    staticChecks.supabaseServerUrl &&
    staticChecks.supabaseClientUrl &&
    staticChecks.supabaseServiceRole &&
    staticChecks.supabaseConsistent
  ) {
    try {
      const admin = getSupabaseAdmin();
      const [autopilotRuns, recoveryReceipts, invoices, deliveryGuards] = await Promise.all([
        probeTable(admin, "autopilot_runs"),
        probeTable(admin, "follow_up_queue"),
        probeTable(admin, "invoices"),
        probeTable(admin, "autopilot_invoice_delivery_guards", "user_id"),
      ]);
      databaseChecks = {
        databaseReachable: autopilotRuns || recoveryReceipts || invoices || deliveryGuards,
        autopilotRuns,
        recoveryReceipts,
        invoices,
        deliveryGuards,
      };
    } catch {
      // Keep all database checks false. This endpoint intentionally exposes no
      // error body, URL, key, project ref, row data, or provider response.
    }
  }

  const checks = { ...staticChecks, ...databaseChecks };
  const ready = Object.values(checks).every(Boolean);
  res.setHeader("Cache-Control", "no-store");
  return res.status(ready ? 200 : 503).json({
    product: "titan-autopilot",
    mode: "free",
    ready,
    checks,
  });
}
