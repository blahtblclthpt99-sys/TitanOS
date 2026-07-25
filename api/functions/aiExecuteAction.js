import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";

async function assertOwnedCustomer(admin, userId, customerId) {
  if (!customerId) return { ok: true, customerId: null };
  const { data, error } = await admin
    .from("customers")
    .select("id, first_name, last_name")
    .eq("id", customerId)
    .eq("created_by_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Customer not found or not owned by you" };
  return { ok: true, customerId: data.id, customer: data };
}

function sanitizeMoney(value, { allowZero = true } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (!allowZero && n <= 0) return null;
  if (n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Execute confirmed Titan AI office actions: schedule job, create estimate, create invoice.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 30, windowMs: 60_000, key: "aiExecuteAction" })) return;

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Sign in required" });

    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: "Session expired" });
    const user = userData.user;
    const { intent, params = {} } = readJson(req);

    const ownership = await assertOwnedCustomer(admin, user.id, params.customer_id || null);
    if (!ownership.ok) return res.status(403).json({ error: ownership.error });

    if (intent === "schedule_job" || intent === "create_job") {
      const amount = sanitizeMoney(params.amount ?? 0);
      if (amount == null) return res.status(400).json({ error: "Invalid amount" });
      const row = {
        title: String(params.title || `Job for ${params.customer_name || "Customer"}`).slice(0, 200),
        customer_name: String(params.customer_name || "").slice(0, 200),
        customer_id: ownership.customerId,
        scheduled_date: params.scheduled_date || new Date().toISOString().slice(0, 10),
        scheduled_time: params.scheduled_time || "09:00",
        status: "scheduled",
        service_type: String(params.service_type || "General").slice(0, 100),
        amount,
        notes: String(params.notes || "Created by Titan AI").slice(0, 2000),
        created_by_id: user.id,
        user_id: user.id,
      };
      const { data, error } = await admin.from("jobs").insert(row).select("*").maybeSingle();
      if (error) throw error;
      return res.status(200).json({
        data: {
          type: "done",
          message: `Scheduled **${data.title}** for ${data.scheduled_date}${data.scheduled_time ? ` at ${data.scheduled_time}` : ""}.`,
          entity: "Job",
          id: data.id,
          path: "/jobs",
        },
      });
    }

    if (intent === "create_estimate") {
      const total = sanitizeMoney(params.total ?? params.amount ?? 0);
      if (total == null) return res.status(400).json({ error: "Invalid estimate total" });
      const row = {
        customer_name: String(params.customer_name || "").slice(0, 200),
        customer_id: ownership.customerId,
        service_type: String(params.service_type || "General").slice(0, 100),
        status: "draft",
        total,
        line_items: Array.isArray(params.line_items)
          ? params.line_items.slice(0, 50)
          : [{ description: params.title || "Service", qty: 1, unit_price: total, total }],
        notes: String(params.notes || "Drafted by Titan AI").slice(0, 2000),
        created_by_id: user.id,
        user_id: user.id,
      };
      const { data, error } = await admin.from("estimates").insert(row).select("*").maybeSingle();
      if (error) throw error;
      return res.status(200).json({
        data: {
          type: "done",
          message: `Created estimate draft for **${data.customer_name || "customer"}** · $${total.toLocaleString()}.`,
          entity: "Estimate",
          id: data.id,
          path: "/estimates",
        },
      });
    }

    if (intent === "create_invoice" || intent === "send_invoice") {
      const total = sanitizeMoney(params.total ?? params.amount ?? 0, { allowZero: false });
      if (total == null) return res.status(400).json({ error: "Invalid invoice total" });
      const row = {
        customer_name: String(params.customer_name || "").slice(0, 200),
        customer_id: ownership.customerId,
        status: intent === "send_invoice" ? "sent" : "draft",
        total,
        balance_due: total,
        due_date: params.due_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        notes: String(params.notes || "Created by Titan AI").slice(0, 2000),
        created_by_id: user.id,
        user_id: user.id,
      };
      const { data, error } = await admin.from("invoices").insert(row).select("*").maybeSingle();
      if (error) throw error;
      return res.status(200).json({
        data: {
          type: "done",
          message: `${intent === "send_invoice" ? "Sent" : "Created"} invoice for **${data.customer_name || "customer"}** · $${total.toLocaleString()}.`,
          entity: "Invoice",
          id: data.id,
          path: "/invoices",
        },
      });
    }

    return res.status(400).json({ error: `Unknown intent: ${intent}` });
  } catch (error) {
    logError("aiExecuteAction", error);
    captureApiException(error, { tags: { route: "aiExecuteAction" } });
    return res.status(500).json({
      error: "Could not complete action",
      hint: "Try creating from the Jobs, Estimates, or Invoices screens.",
    });
  }
}
