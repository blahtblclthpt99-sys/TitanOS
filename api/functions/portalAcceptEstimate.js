import { getSupabaseAdmin, readJson, toEntityRow } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

async function requirePortalSession(admin, token) {
  if (!token || typeof token !== "string") return { error: "Missing session token", status: 400 };
  const { data: sessions } = await admin.from("portal_sessions").select("*").eq("token", token).limit(1);
  const session = sessions?.[0];
  if (!session?.verified) return { error: "Invalid or expired session", status: 401 };
  if (!session.token_expires_at || new Date(session.token_expires_at) < new Date()) {
    return { error: "Session expired. Please sign in again.", status: 401 };
  }
  return { session };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
    console.error("portalAcceptEstimate error:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
