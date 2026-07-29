import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { isAllowedAiIntent } from "../_lib/aiIntents.js";
import { requireFeature, FEATURES } from "../_lib/entitlements.js";

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

export function sanitizeMoney(value, { allowZero = true } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (!allowZero && n <= 0) return null;
  if (n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

function sanitizeText(value, max = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sanitizeIsoDate(value, fallback) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return fallback;
}

const ENTITY_TABLE = Object.freeze({
  Job: "jobs",
  Estimate: "estimates",
  Invoice: "invoices",
  Customer: "customers",
  Expense: "expenses",
});

/**
 * Shared AI office action executor (ownership + money sanitize).
 * Used by aiExecuteAction HTTP handler and titanAI confirmedAction path.
 */
export async function executeAiOfficeAction(admin, user, intent, params = {}) {
  if (!isAllowedAiIntent(intent)) {
    const err = new Error(`Unknown intent: ${intent}`);
    err.status = 400;
    throw err;
  }

  const ownership = await assertOwnedCustomer(admin, user.id, params.customer_id || null);
  if (!ownership.ok) {
    const err = new Error(ownership.error);
    err.status = 403;
    throw err;
  }

  if (intent === "schedule_job" || intent === "create_job") {
    const amount = sanitizeMoney(params.amount ?? 0);
    if (amount == null) {
      const err = new Error("Invalid amount");
      err.status = 400;
      throw err;
    }
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
    return {
      type: "done",
      message: `Scheduled **${data.title}** for ${data.scheduled_date}${data.scheduled_time ? ` at ${data.scheduled_time}` : ""}.`,
      entity: "Job",
      id: data.id,
      path: "/jobs",
      rollback: { kind: "delete", entity: "Job", id: data.id },
    };
  }

  if (intent === "create_estimate") {
    const total = sanitizeMoney(params.total ?? params.amount ?? 0);
    if (total == null) {
      const err = new Error("Invalid estimate total");
      err.status = 400;
      throw err;
    }
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
    return {
      type: "done",
      message: `Created estimate draft for **${data.customer_name || "customer"}** · $${total.toLocaleString()}.`,
      entity: "Estimate",
      id: data.id,
      path: "/estimates",
      rollback: { kind: "delete", entity: "Estimate", id: data.id },
    };
  }

  if (intent === "create_invoice" || intent === "send_invoice") {
    const total = sanitizeMoney(params.total ?? params.amount ?? 0, { allowZero: false });
    if (total == null) {
      const err = new Error("Invalid invoice total");
      err.status = 400;
      throw err;
    }
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
    return {
      type: "done",
      message:
        intent === "send_invoice"
          ? `Marked invoice as **sent** for **${data.customer_name || "customer"}** · $${total.toLocaleString()}. Email/share is separate — open Invoices to send the link.`
          : `Created invoice draft for **${data.customer_name || "customer"}** · $${total.toLocaleString()}.`,
      entity: "Invoice",
      id: data.id,
      path: "/invoices",
      rollback: { kind: "delete", entity: "Invoice", id: data.id },
    };
  }

  if (intent === "create_customer") {
    const firstName = sanitizeText(params.first_name || params.firstName, 100);
    const lastName = sanitizeText(params.last_name || params.lastName, 100);
    const customerName = sanitizeText(params.customer_name || params.customerName, 200);
    const fallbackParts = customerName.split(" ").filter(Boolean);
    const resolvedFirst = firstName || fallbackParts[0] || "Customer";
    const resolvedLast =
      lastName || (fallbackParts.length > 1 ? fallbackParts.slice(1).join(" ").slice(0, 100) : "");
    const email = sanitizeText(params.email, 200).toLowerCase();

    const row = {
      first_name: resolvedFirst,
      last_name: resolvedLast,
      email: email || null,
      phone: sanitizeText(params.phone, 40) || null,
      address: sanitizeText(params.address, 200) || null,
      city: sanitizeText(params.city, 120) || null,
      state: sanitizeText(params.state, 40) || null,
      zip: sanitizeText(params.zip, 20) || null,
      status: sanitizeText(params.status || "lead", 20) || "lead",
      source: sanitizeText(params.source || "ai", 40) || "ai",
      notes: sanitizeText(params.notes || "Created by Titan AI", 2000),
      created_by_id: user.id,
      user_id: user.id,
    };

    if (row.email) {
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .eq("created_by_id", user.id)
        .eq("email", row.email)
        .limit(1);
      if (Array.isArray(existing) && existing.length > 0) {
        const err = new Error("A customer with that email already exists.");
        err.status = 400;
        throw err;
      }
    }

    const { data, error } = await admin.from("customers").insert(row).select("*").maybeSingle();
    if (error) throw error;
    return {
      type: "done",
      message: `Created customer **${[data.first_name, data.last_name].filter(Boolean).join(" ").trim() || "Customer"}**.`,
      entity: "Customer",
      id: data.id,
      path: "/customers",
      rollback: { kind: "delete", entity: "Customer", id: data.id },
    };
  }

  if (intent === "record_expense") {
    const amount = sanitizeMoney(params.amount, { allowZero: false });
    if (amount == null) {
      const err = new Error("Invalid expense amount");
      err.status = 400;
      throw err;
    }
    const date = sanitizeIsoDate(params.date, new Date().toISOString().slice(0, 10));
    const businessUsePercent = Math.min(100, Math.max(0, Number(params.business_use_percent ?? 100) || 100));
    const row = {
      description: sanitizeText(params.description || "Expense", 300) || "Expense",
      amount,
      category: sanitizeText(params.category || "other", 80) || "other",
      date,
      vendor: sanitizeText(params.vendor, 200) || null,
      receipt_url: sanitizeText(params.receipt_url, 1000) || null,
      is_tax_deductible: params.is_tax_deductible !== false,
      tax_year: Number(date.slice(0, 4)),
      business_use_percent: Math.round(businessUsePercent * 100) / 100,
      notes: sanitizeText(params.notes || "Recorded by Titan AI", 2000) || "Recorded by Titan AI",
      created_by_id: user.id,
      user_id: user.id,
    };
    const { data, error } = await admin.from("expenses").insert(row).select("*").maybeSingle();
    if (error) throw error;
    return {
      type: "done",
      message: `Recorded expense **${data.description}** for **$${Number(data.amount || 0).toLocaleString()}**.`,
      entity: "Expense",
      id: data.id,
      path: "/finances",
      rollback: { kind: "delete", entity: "Expense", id: data.id },
    };
  }

  const err = new Error(`Unknown intent: ${intent}`);
  err.status = 400;
  throw err;
}

export async function rollbackAiOfficeAction(admin, user, rollbackAction = {}) {
  const kind = String(rollbackAction.kind || "");
  const entity = String(rollbackAction.entity || "");
  const id = String(rollbackAction.id || "");
  if (kind !== "delete" || !entity || !id) {
    const err = new Error("Rollback payload is invalid.");
    err.status = 400;
    throw err;
  }
  const table = ENTITY_TABLE[entity];
  if (!table) {
    const err = new Error("Rollback target is unsupported.");
    err.status = 400;
    throw err;
  }

  const { data: found, error: readErr } = await admin
    .from(table)
    .select("id,created_by_id")
    .eq("id", id)
    .eq("created_by_id", user.id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!found) {
    const err = new Error("Rollback target not found or not owned by you.");
    err.status = 403;
    throw err;
  }

  const { error: delErr } = await admin.from(table).delete().eq("id", id).eq("created_by_id", user.id);
  if (delErr) throw delErr;

  return {
    type: "done",
    message: `Rolled back ${entity} ${id.slice(0, 8)} successfully.`,
    entity,
    id,
  };
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

    const entitled = await requireFeature(res, admin, user, FEATURES.aiAssistant);
    if (!entitled) return;

    const { intent, params = {} } = readJson(req);

    const data = await executeAiOfficeAction(admin, user, intent, params);
    return res.status(200).json({ data });
  } catch (error) {
    if (error?.status === 400 || error?.status === 403) {
      return res.status(error.status).json({ error: error.message });
    }
    logError("aiExecuteAction", error);
    captureApiException(error, { tags: { route: "aiExecuteAction" } });
    return res.status(500).json({
      error: "Could not complete action",
      hint: "Try creating from the Jobs, Estimates, or Invoices screens.",
    });
  }
}
