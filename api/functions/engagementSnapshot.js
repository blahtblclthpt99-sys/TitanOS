import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { deriveEngagementSnapshot } from "../../src/lib/engagement.js";

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function safeEvent(row) {
  return {
    id: row.id,
    interaction_type: row.interaction_type,
    status: row.status,
    attribution: row.attribution,
    occurred_at: row.occurred_at,
    completed_at: row.completed_at,
    disputed: Boolean(row.disputed),
    response_minutes: Number.isFinite(Number(row?.metadata?.response_minutes)) ? Number(row.metadata.response_minutes) : null,
  };
}

async function canReviewSubject(auth, subjectUserId, opportunityId) {
  if (subjectUserId === auth.user.id) {
    const { data: ownProfile } = await auth.admin
      .from("profiles")
      .select("active_workspace")
      .eq("id", auth.user.id)
      .maybeSingle();
    return {
      allowed: true,
      own: true,
      subjectKind: clean(ownProfile?.active_workspace) === "business" ? "business" : "worker",
    };
  }
  if (!opportunityId) return { allowed: false, own: false, subjectKind: "worker" };

  const { data: opportunity, error } = await auth.admin
    .from("hire_jobs")
    .select("id,status,customer_id,created_by_id,relationship_type")
    .eq("id", opportunityId)
    .maybeSingle();
  if (error || !opportunity) return { allowed: false, own: false, subjectKind: "worker" };

  const ownerId = String(opportunity.customer_id || opportunity.created_by_id || "");
  const requesterId = String(auth.user.id);
  const requesterOwns = ownerId === requesterId;
  const admin = auth.user.app_metadata?.role === "admin";
  const relationship = clean(opportunity.relationship_type || "employment");

  if (requesterOwns || admin) {
    if (relationship === "employment") {
      const { data } = await auth.admin
        .from("employment_profiles")
        .select("user_id")
        .eq("user_id", subjectUserId)
        .eq("discoverable", true)
        .maybeSingle();
      return { allowed: Boolean(data), own: false, subjectKind: "worker" };
    }

    if (relationship === "contract" || relationship === "customer_request") {
      const { data } = await auth.admin
        .from("service_profiles")
        .select("user_id")
        .eq("user_id", subjectUserId)
        .eq("published", true)
        .maybeSingle();
      return { allowed: Boolean(data), own: false, subjectKind: "worker" };
    }

    return { allowed: false, own: false, subjectKind: "worker" };
  }

  // Symmetric trust: a worker considering a currently open opportunity may see
  // the opportunity owner's business Engagement. This is not a general user
  // lookup and does not expose arbitrary accounts.
  if (String(subjectUserId) === ownerId && clean(opportunity.status) === "open") {
    return { allowed: true, own: false, subjectKind: "business" };
  }

  return { allowed: false, own: false, subjectKind: "worker" };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 40, windowMs: 60_000, key: "engagementSnapshot" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  const body = readJson(req);
  const subjectUserId = String(body.subject_user_id || body.subjectUserId || auth.user.id).trim();
  const opportunityId = String(body.opportunity_id || body.opportunityId || "").trim();
  if (!subjectUserId) return res.status(400).json({ error: "Subject is required" });

  // Engagement is never a filtering API. Reject filter-shaped inputs rather than
  // quietly accepting a contract that could later be abused for candidate exclusion.
  const forbiddenFilterKeys = [
    "engagement_min",
    "engagement_max",
    "responsiveness_min",
    "attendance_min",
    "minimum_engagement",
  ];
  if (forbiddenFilterKeys.some((key) => body[key] !== undefined)) {
    return res.status(400).json({ error: "Engagement is informational and cannot be used as an eligibility or candidate filter." });
  }

  const access = await canReviewSubject(auth, subjectUserId, opportunityId);
  if (!access.allowed) {
    return res.status(403).json({ error: "Engagement information is only available for your own account or a participant in a specific opportunity you are allowed to review." });
  }

  const since = new Date(Date.now() - 366 * 86_400_000).toISOString();
  const { data: rows, error } = await auth.admin
    .from("engagement_interaction_events")
    .select("id,subject_user_id,subject_kind,counterparty_user_id,opportunity_id,interaction_type,status,attribution,expected_by,completed_at,occurred_at,disputed,metadata,created_at")
    .eq("subject_user_id", subjectUserId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) return res.status(400).json({ error: "Could not load Engagement information." });

  const snapshot = deriveEngagementSnapshot(rows || [], {
    subjectKind: rows?.[0]?.subject_kind || access.subjectKind || "worker",
  });

  const eventSummaries = snapshot.events.map((event) => safeEvent(event));
  return res.status(200).json({
    data: {
      probability: snapshot.probability,
      probabilityLabel: snapshot.probabilityLabel,
      confidence: snapshot.confidence,
      sampleSize: snapshot.sampleSize,
      stats: snapshot.stats,
      policy: snapshot.policy,
      events: eventSummaries,
      own: access.own,
      subject_kind: access.subjectKind,
      informational_only: true,
      eligibility_input: false,
      ranking_input: false,
    },
  });
}
