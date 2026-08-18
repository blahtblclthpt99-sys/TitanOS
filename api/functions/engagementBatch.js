import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { deriveEngagementSnapshot } from "../../src/lib/engagement.js";

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 50);
}

function compact(snapshot) {
  return {
    probability: snapshot.probability,
    probabilityLabel: snapshot.probabilityLabel,
    confidence: snapshot.confidence,
    sampleSize: snapshot.sampleSize,
    stats: snapshot.stats,
    policy: snapshot.policy,
    events: [],
    own: false,
    informational_only: true,
    eligibility_input: false,
    ranking_input: false,
  };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 30, windowMs: 60_000, key: "engagementBatch" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  const body = readJson(req);
  const opportunityId = String(body.opportunity_id || body.opportunityId || "").trim();
  const requestedIds = uniqueIds(body.subject_user_ids || body.subjectUserIds);
  if (!opportunityId || !requestedIds.length) return res.status(400).json({ error: "Opportunity and subjects are required." });

  const forbiddenFilterKeys = [
    "engagement_min",
    "engagement_max",
    "responsiveness_min",
    "attendance_min",
    "minimum_engagement",
    "sort_by_engagement",
  ];
  if (forbiddenFilterKeys.some((key) => body[key] !== undefined)) {
    return res.status(400).json({ error: "Engagement is informational and cannot filter, rank, or exclude candidates." });
  }

  const { data: opportunity, error: opportunityError } = await auth.admin
    .from("hire_jobs")
    .select("id,customer_id,created_by_id,relationship_type")
    .eq("id", opportunityId)
    .maybeSingle();
  if (opportunityError || !opportunity) return res.status(404).json({ error: "Opportunity not found." });

  const ownerId = opportunity.customer_id || opportunity.created_by_id;
  const adminRole = auth.user.app_metadata?.role === "admin";
  if (ownerId !== auth.user.id && !adminRole) return res.status(403).json({ error: "Only the opportunity owner can view Engagement information." });

  const relationship = String(opportunity.relationship_type || "employment").toLowerCase();
  let allowedRows = [];
  if (relationship === "employment") {
    const result = await auth.admin
      .from("employment_profiles")
      .select("user_id")
      .in("user_id", requestedIds)
      .eq("discoverable", true);
    if (result.error) return res.status(400).json({ error: "Could not validate discoverable Job Seeker profiles." });
    allowedRows = result.data || [];
  } else if (relationship === "contract" || relationship === "customer_request") {
    const result = await auth.admin
      .from("service_profiles")
      .select("user_id")
      .in("user_id", requestedIds)
      .eq("published", true);
    if (result.error) return res.status(400).json({ error: "Could not validate published Service Profiles." });
    allowedRows = result.data || [];
  } else {
    return res.status(400).json({ error: "Unsupported opportunity relationship." });
  }

  const allowedIds = [...new Set(allowedRows.map((row) => String(row.user_id)).filter(Boolean))];
  if (!allowedIds.length) return res.status(200).json({ data: { snapshots: {} } });

  const since = new Date(Date.now() - 366 * 86_400_000).toISOString();
  const { data: events, error: eventsError } = await auth.admin
    .from("engagement_interaction_events")
    .select("id,subject_user_id,subject_kind,interaction_type,status,attribution,completed_at,occurred_at,disputed,metadata,created_at")
    .in("subject_user_id", allowedIds)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(5000);
  if (eventsError) return res.status(400).json({ error: "Could not load Engagement information." });

  const bySubject = new Map(allowedIds.map((id) => [id, []]));
  for (const event of events || []) {
    const id = String(event.subject_user_id || "");
    if (bySubject.has(id)) bySubject.get(id).push(event);
  }

  const snapshots = {};
  for (const id of allowedIds) {
    const rows = bySubject.get(id) || [];
    snapshots[id] = compact(deriveEngagementSnapshot(rows, { subjectKind: rows?.[0]?.subject_kind || "worker" }));
  }

  return res.status(200).json({
    data: {
      snapshots,
      informational_only: true,
      eligibility_input: false,
      ranking_input: false,
      ordering_unchanged: true,
    },
  });
}
