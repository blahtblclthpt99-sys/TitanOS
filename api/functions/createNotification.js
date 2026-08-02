import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { sanitizeAppPath, isUuid } from "../_lib/safePath.js";

async function canNotifyUser(admin, callerId, targetId, isAdmin) {
  if (callerId === targetId || isAdmin) return true;

  // Shared message thread
  const { data: messages } = await admin
    .from("marketplace_messages")
    .select("id")
    .or(
      `and(sender_id.eq.${callerId},recipient_id.eq.${targetId}),and(sender_id.eq.${targetId},recipient_id.eq.${callerId})`
    )
    .limit(1);
  if (messages?.length) return true;

  // Caller owns a hire job the target applied to (or was hired on)
  const { data: ownedJobs } = await admin
    .from("hire_jobs")
    .select("id")
    .or(`created_by_id.eq.${callerId},customer_id.eq.${callerId}`)
    .limit(100);
  const ownedIds = (ownedJobs || []).map((j) => String(j.id));
  if (ownedIds.length) {
    const { data: apps } = await admin
      .from("hire_applications")
      .select("id, hire_job_id, worker_id")
      .eq("worker_id", targetId)
      .limit(100);
    if ((apps || []).some((a) => ownedIds.includes(String(a.hire_job_id)))) return true;

    const { data: hired } = await admin
      .from("hire_jobs")
      .select("id")
      .eq("hired_worker_id", targetId)
      .in("id", ownedIds)
      .limit(1);
    if (hired?.length) return true;
  }

  // Same active company
  const { data: myCompanies } = await admin
    .from("company_members")
    .select("company_id")
    .eq("user_id", callerId)
    .eq("status", "active")
    .limit(50);
  const companyIds = (myCompanies || []).map((r) => r.company_id).filter(Boolean);
  if (companyIds.length) {
    const { data: peer } = await admin
      .from("company_members")
      .select("id")
      .eq("user_id", targetId)
      .eq("status", "active")
      .in("company_id", companyIds)
      .limit(1);
    if (peer?.length) return true;
  }

  return false;
}

/**
 * Cross-user notifications must go through service role (RLS blocks client inserts for others).
 * Authenticated + rate-limited; recipient must exist and be related to caller.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 40, windowMs: 60_000, key: "createNotification" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const userId = String(body.user_id || "").trim();
    const title = String(body.title || "").trim().slice(0, 200);
    const type = String(body.type || "system").slice(0, 64);
    if (!userId || !title) {
      return res.status(400).json({ error: "user_id and title required" });
    }
    if (!isUuid(userId)) {
      return res.status(400).json({ error: "user_id must be a valid UUID" });
    }
    const link = sanitizeAppPath(body.link);

    const { admin, user } = auth;
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = profile?.role === "admin" || user.app_metadata?.role === "admin";

    const { data: recipient } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    const allowed = await canNotifyUser(admin, user.id, userId, isAdmin);
    if (!allowed) {
      return res.status(403).json({ error: "Not allowed to notify this user" });
    }

    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        body: String(body.body || "").slice(0, 2000),
        link,
        meta: body.meta && typeof body.meta === "object" ? body.meta : {},
        created_by_id: user.id,
      })
      .select("*")
      .single();

    if (error) {
      const { sendDbClientError } = await import("../_lib/apiError.js");
      return sendDbClientError(res, error, {
        route: "createNotification",
        category: "notifications",
        publicMessage: "Could not create notification",
      });
    }
    return res.status(200).json({ notification: data });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "createNotification",
      category: "notifications",
      publicMessage: "Failed to create notification",
      publicCode: "NOTIFICATION_CREATE_FAILED",
    });
  }
}
