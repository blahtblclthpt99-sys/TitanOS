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
  if (!assertRateLimit(req, res, { limit: 20, windowMs: 60_000, key: "portalLeaveReview" })) return;

  try {
    const admin = getSupabaseAdmin();
    const { token, job_id: jobId, rating, comment = "" } = readJson(req);
    const auth = await requirePortalSession(admin, token);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (!auth.session.created_by_id) return res.status(401).json({ error: "Invalid or expired session" });
    if (!jobId) return res.status(400).json({ error: "job_id is required" });
    const stars = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id,status,customer_id,created_by_id")
      .eq("id", jobId)
      .eq("customer_id", auth.session.customer_id)
      .eq("created_by_id", auth.session.created_by_id)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return res.status(404).json({ error: "Job not found" });

    const payload = {
      job_id: jobId,
      rating: stars,
      body: String(comment).trim().slice(0, 2000),
      reviewer_role: "customer",
      reviewer_id: String(auth.session.customer_id),
      reviewee_id: String(auth.session.created_by_id),
      created_by_id: auth.session.created_by_id,
      badges: [],
    };

    const { data: review, error } = await admin
      .from("job_reviews")
      .insert(payload)
      .select("id,created_at,updated_at,job_id,reviewer_id,reviewee_id,reviewer_role,rating,body,badges")
      .maybeSingle();
    if (error) throw error;

    await admin.from("portal_actions").insert({
      customer_id: auth.session.customer_id,
      action: "leave_review",
      entity_type: "job",
      entity_id: jobId,
      meta: { rating: stars, owner_id: auth.session.created_by_id },
    });

    return res.status(200).json({ review: toEntityRow(review) });
  } catch (error) {
    logError("portalLeaveReview", error);
    captureApiException(error, { tags: { route: "portalLeaveReview" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
