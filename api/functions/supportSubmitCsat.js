import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { cleanSupportMessage, loadOwnedSupportCase, writeSupportAuditBestEffort } from "../_lib/support.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 6, windowMs: 60 * 60_000, key: "supportSubmitCsat", requireDurable: true }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const supportCase = await loadOwnedSupportCase(auth.admin, auth.user.id, body.case_id);
    if (!supportCase) return res.status(404).json({ error: "Support case not found." });
    if (!["RESOLVED", "CLOSED"].includes(supportCase.status)) {
      return res.status(409).json({ error: "Satisfaction feedback is available after resolution." });
    }
    if (typeof body.solved !== "boolean") return res.status(400).json({ error: "Choose whether the problem was solved." });
    const rating = body.rating == null ? null : Number(body.rating);
    if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "Rating must be from 1 to 5." });
    }
    const comment = body.comment ? cleanSupportMessage(body.comment, 2000) : null;

    const { data, error } = await auth.admin
      .from("support_csat")
      .insert({
        case_id: supportCase.id,
        created_by_id: auth.user.id,
        solved: body.solved,
        rating,
        comment,
      })
      .select("id,solved,rating,comment,created_at")
      .single();
    if (error?.code === "23505") return res.status(409).json({ error: "Feedback was already submitted for this case." });
    if (error) throw error;

    await writeSupportAuditBestEffort(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "support_csat_submitted",
      targetType: "support_csat",
      targetId: data.id,
      metadata: { solved: body.solved, rating: rating ?? 0 },
    }, "supportSubmitCsat:audit");

    return res.status(201).json({ csat: data });
  } catch (error) {
    logError("supportSubmitCsat", error);
    captureApiException(error, { tags: { route: "supportSubmitCsat" } });
    return res.status(500).json({ error: "Support feedback could not be saved." });
  }
}
