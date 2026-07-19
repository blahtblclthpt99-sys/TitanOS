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
    const { token, job_id: jobId, rating, comment = "" } = readJson(req);
    const auth = await requirePortalSession(admin, token);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (!jobId) return res.status(400).json({ error: "job_id is required" });
    const stars = Math.min(5, Math.max(1, Number(rating) || 5));

    const { data: job } = await admin
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("customer_id", auth.session.customer_id)
      .maybeSingle();
    if (!job) return res.status(404).json({ error: "Job not found" });

    const payload = {
      job_id: jobId,
      rating: stars,
      comment: String(comment).slice(0, 2000),
      reviewer_role: "customer",
      reviewee_id: job.created_by_id || job.user_id || "",
      customer_id: auth.session.customer_id,
    };

    const { data: review, error } = await admin.from("job_reviews").insert(payload).select("*").maybeSingle();
    if (error) throw error;

    await admin.from("portal_actions").insert({
      customer_id: auth.session.customer_id,
      action: "leave_review",
      entity_type: "job",
      entity_id: jobId,
      meta: { rating: stars },
    });

    return res.status(200).json({ review: toEntityRow(review) });
  } catch (error) {
    console.error("portalLeaveReview error:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
