import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { isSupportAdmin, writeSupportAudit } from "../_lib/support.js";

function average(values, precision = 1) {
  const numbers = values.filter((n) => Number.isFinite(n) && n >= 0);
  if (!numbers.length) return null;
  const factor = 10 ** precision;
  return Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * factor) / factor;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 20, windowMs: 60_000, key: "supportAnalytics" }))) return;
  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!isSupportAdmin(auth.user)) return res.status(403).json({ error: "Support admin access required." });

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [casesResult, csatResult, incidentsResult] = await Promise.all([
      auth.admin.from("support_cases").select("id,category,status,priority,platform,app_version,created_at,first_response_at,escalated_at,resolved_at,closed_at").gte("created_at", since).limit(5000),
      auth.admin.from("support_csat").select("case_id,solved,rating,created_at").gte("created_at", since).limit(5000),
      auth.admin.from("support_incidents").select("id,status,severity,created_at,resolved_at").gte("created_at", since).limit(1000),
    ]);
    for (const result of [casesResult, csatResult, incidentsResult]) if (result.error) throw result.error;
    const cases = casesResult.data || [];
    const csat = csatResult.data || [];
    const incidents = incidentsResult.data || [];

    const countBy = (field) => Object.fromEntries(
      [...cases.reduce((map, row) => map.set(row[field] || "unknown", (map.get(row[field] || "unknown") || 0) + 1), new Map())]
        .sort((a, b) => b[1] - a[1])
    );
    const firstResponseMinutes = cases.map((row) => row.first_response_at ? (new Date(row.first_response_at) - new Date(row.created_at)) / 60000 : NaN);
    const resolutionMinutes = cases.map((row) => row.resolved_at ? (new Date(row.resolved_at) - new Date(row.created_at)) / 60000 : NaN);
    const resolved = cases.filter((row) => ["RESOLVED", "CLOSED"].includes(row.status));
    const escalated = cases.filter((row) => row.escalated_at);
    const aiHandled = cases.filter((row) => !row.escalated_at && ["AI_WORKING", "NEEDS_USER", "RESOLVED", "CLOSED"].includes(row.status));
    const ratings = csat.map((row) => Number(row.rating)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

    const analytics = {
      window_days: 30,
      total_cases: cases.length,
      open_cases: cases.filter((row) => !["RESOLVED", "CLOSED"].includes(row.status)).length,
      urgent_cases: cases.filter((row) => ["P0", "P1"].includes(row.priority) && !["RESOLVED", "CLOSED"].includes(row.status)).length,
      average_first_response_minutes: average(firstResponseMinutes),
      average_resolution_minutes: average(resolutionMinutes),
      human_escalation_percentage: cases.length ? Math.round((escalated.length / cases.length) * 1000) / 10 : 0,
      ai_handled_percentage: cases.length ? Math.round((aiHandled.length / cases.length) * 1000) / 10 : 0,
      resolved_percentage: cases.length ? Math.round((resolved.length / cases.length) * 1000) / 10 : 0,
      solved_csat_percentage: csat.length ? Math.round((csat.filter((row) => row.solved).length / csat.length) * 1000) / 10 : null,
      average_csat_rating: average(ratings, 2),
      by_category: countBy("category"),
      by_platform: countBy("platform"),
      by_version: countBy("app_version"),
      incidents: {
        total: incidents.length,
        active: incidents.filter((row) => row.status !== "RESOLVED").length,
        p0_p1: incidents.filter((row) => ["P0", "P1"].includes(row.severity)).length,
      },
    };

    await writeSupportAudit(auth.admin, { actorUserId: auth.user.id, action: "support_analytics_viewed", targetType: "support_analytics", metadata: { window_days: 30 } });
    return res.status(200).json({ analytics });
  } catch (error) {
    logError("supportAnalytics", error);
    captureApiException(error, { tags: { route: "supportAnalytics" } });
    return res.status(500).json({ error: "Support analytics could not be loaded." });
  }
}
