import { getSupabaseAdmin, readJson, toEntityRow } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { logError } from "../_lib/safeLog.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { requirePortalSession } from "../_lib/requirePortalSession.js";

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

    if (!estimateId) return res.status(400).json({ error: "estimate_id is required" });
    const status = decision === "declined" ? "declined" : "accepted";

    const { data: estimate, error: findErr } = await admin
      .from("estimates")
      .select("*")
      .eq("id", estimateId)
      .eq("customer_id", auth.session.customer_id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!estimate) return res.status(404).json({ error: "Estimate not found" });

    const { data: updated, error } = await admin
      .from("estimates")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", estimateId)
      .select("*")
      .maybeSingle();
    if (error) throw error;

    await admin.from("portal_actions").insert({
      customer_id: auth.session.customer_id,
      action: status === "accepted" ? "accept_estimate" : "decline_estimate",
      entity_type: "estimate",
      entity_id: estimateId,
      meta: { total: estimate.total || 0 },
    });

    return res.status(200).json({ estimate: toEntityRow(updated) });
  } catch (error) {
    logError("portalAcceptEstimate", error);
    captureApiException(error, { tags: { route: "portalAcceptEstimate" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
