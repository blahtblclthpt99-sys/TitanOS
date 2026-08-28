/**
 * Append-only audit trail helper (service role). Never stores secrets in metadata.
 */
import { createHash } from "node:crypto";
import { logWarn, redactValue } from "./safeLog.js";

function auditIpPepper() {
  const value = String(process.env.AUDIT_IP_PEPPER || "").trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUDIT_IP_PEPPER is required in production");
  }
  return "titanos-audit-dev-only";
}

function hashIp(ip) {
  if (!ip) return null;
  return createHash("sha256").update(`${auditIpPepper()}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{
 *   actorId?: string|null,
 *   action: string,
 *   entityType?: string,
 *   entityId?: string|null,
 *   metadata?: Record<string, unknown>,
 *   requestId?: string,
 *   ip?: string|null,
 * }} event
 */
export async function writeAuditEvent(admin, event) {
  if (!admin || !event?.action) return { ok: false, reason: "invalid" };
  try {
    const row = {
      actor_id: event.actorId || null,
      action: String(event.action).slice(0, 120),
      entity_type: event.entityType ? String(event.entityType).slice(0, 80) : null,
      entity_id: event.entityId != null ? String(event.entityId).slice(0, 120) : null,
      metadata: redactValue(event.metadata || {}),
      request_id: event.requestId ? String(event.requestId).slice(0, 64) : null,
      ip_hash: hashIp(event.ip),
    };
    const { error } = await admin.from("audit_events").insert(row);
    if (error) {
      logWarn("audit", error.message || "insert_failed", { action: row.action });
      return { ok: false, reason: "db" };
    }
    return { ok: true };
  } catch (err) {
    logWarn("audit", err?.message || "audit_failed");
    return { ok: false, reason: "exception" };
  }
}

export function clientIpFromReq(req) {
  const xf = req?.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  return req?.socket?.remoteAddress || null;
}
