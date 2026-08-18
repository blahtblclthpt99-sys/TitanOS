import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, {
    limit: 60,
    windowMs: 60_000,
    key: "supportListCases",
  }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { data, error } = await auth.admin
      .from("support_cases")
      .select("id,case_number,title,category,status,priority,source,platform,app_version,last_message_at,first_response_at,escalated_at,resolved_at,closed_at,created_at,updated_at")
      .eq("created_by_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return res.status(200).json({ cases: data || [] });
  } catch (error) {
    logError("supportListCases", error);
    captureApiException(error, { tags: { route: "supportListCases" } });
    return res.status(500).json({ error: "Support cases could not be loaded." });
  }
}
