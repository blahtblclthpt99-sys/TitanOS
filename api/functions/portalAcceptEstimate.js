import { getSupabaseAdmin, readJson, toEntityRow } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { logError } from "../_lib/safeLog.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { requirePortalSession } from "../_lib/requirePortalSession.js";

const PORTAL_ESTIMATE_FIELDS = "id,created_at,updated_at,estimate_number,customer_id,customer_name,status,line_items,subtotal,tax_rate,tax_amount,discount,total,valid_until,service_type,address";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 30, windowMs: 60_000, key: "portalAcceptEstimate" })) return;

  try {
    const admin = getSupabaseAdmin();
    const { token, estimate_id: estimateId, decision = "accepted" } = readJson(req);
    const auth = await requirePortalSession(admin, token);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (!auth.session.created_by_id) return res.status(401).json({ error: "Invalid or expired session" });

    if (!estimateId) return res.status(400).json({ error: "estimate_id is required" });
    const status = decision === "declined" ? "declined" : "accepted";

    const { data: estimate, error: findErr } = await admin
      .from("estimates")
      .select("id,total,status,customer_id,created_by_id")
      .eq("id", estimateId)
      .eq("customer_id", auth.session.customer_id)
      .eq("created_by_id", auth.session.created_by_id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!estimate) return res.status(404).json({ error: "Estimate not found" });
    if (!["sent", "draft"].includes(String(estimate.status || "").toLowerCase())) {
      return res.status(409).json({ error: "Estimate can no longer be changed from the portal" });
    }

    const { data: updated, error } = await admin
      .from("estimates")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", estimateId)
      .eq("customer_id", auth.session.customer_id)
      .eq("created_by_id", auth.session.created_by_id)
      .select(PORTAL_ESTIMATE_FIELDS)
      .maybeSingle();
    if (error) throw error;
    if (!updated) return res.status(409).json({ error: "Estimate could not be updated" });

    await admin.from("portal_actions").insert({
      customer_id: auth.session.customer_id,
      action: status === "accepted" ? "accept_estimate" : "decline_estimate",
      entity_type: "estimate",
      entity_id: estimateId,
      meta: { total: estimate.total || 0, owner_id: auth.session.created_by_id },
    });

    return res.status(200).json({ estimate: toEntityRow(updated) });
  } catch (error) {
    logError("portalAcceptEstimate", error);
    captureApiException(error, { tags: { route: "portalAcceptEstimate" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
