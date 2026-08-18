export const ENGAGEMENT_POLICY = Object.freeze({
  label: "Engagement",
  description: "Estimated response probability from attributable interaction behavior inside Titan.",
  warning: "Engagement estimates how this person has interacted with Titan business requests. It does not measure ability, qualifications, job performance, or hiring suitability and must not be used to disqualify a candidate.",
  immutableRule: "Behavioral engagement signals may never determine qualification, eligibility, visibility, automatic rejection, candidate ordering, or access to employment opportunities.",
});

const POSITIVE_WORKER = new Set([
  "responded",
  "confirmed",
  "attended",
  "declined",
  "not_interested",
  "candidate_cancelled",
  "candidate_rescheduled",
  "mutually_rescheduled",
  "completed",
]);

const POSITIVE_BUSINESS = new Set([
  "responded",
  "confirmed",
  "employer_cancelled",
  "employer_rescheduled",
  "mutually_rescheduled",
  "completed",
]);

const ALWAYS_NEUTRAL = new Set([
  "technical_issue",
  "disputed",
]);

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function timestamp(value) {
  const n = Date.parse(value || "");
  return Number.isFinite(n) ? n : null;
}

function recencyWeight(event, nowMs) {
  const at = timestamp(event.occurred_at || event.occurredAt || event.created_at || event.createdAt);
  if (!at) return 0;
  const ageDays = Math.max(0, (nowMs - at) / 86_400_000);
  if (ageDays <= 90) return 1;
  if (ageDays <= 180) return 0.65;
  if (ageDays <= 365) return 0.35;
  return 0;
}

function subjectAttribution(subjectKind) {
  return clean(subjectKind) === "business" ? "business" : "candidate";
}

/**
 * Classifies only the communication/follow-through meaning of a raw event.
 * Declining, negotiating/not pursuing, responsible cancellation, and responsible
 * rescheduling are positive communication—not obedience signals.
 */
export function classifyEngagementEvent(event = {}) {
  const status = clean(event.status);
  const subjectKind = clean(event.subject_kind || event.subjectKind) === "business" ? "business" : "worker";
  const attribution = clean(event.attribution);
  const disputed = Boolean(event.disputed) || status === "disputed";

  if (disputed || ALWAYS_NEUTRAL.has(status)) return "neutral";

  const ownAttribution = subjectAttribution(subjectKind);
  const counterpartyAttribution = subjectKind === "business" ? "candidate" : "business";

  // Counterparty-caused cancellations/reschedules never count against the subject.
  if (attribution === counterpartyAttribution) return "neutral";

  const positives = subjectKind === "business" ? POSITIVE_BUSINESS : POSITIVE_WORKER;
  if (positives.has(status)) {
    // Some outcome rows may be system-recorded after a clearly communicated
    // action; allow system/mutual as positive for explicitly positive statuses.
    if ([ownAttribution, "mutual", "system"].includes(attribution) || !attribution) return "positive";
    return "neutral";
  }

  if (status === "no_response" || status === "no_show") {
    // Negative evidence requires clear attribution to the subject. Unknown/system
    // attribution is insufficient and stays neutral.
    return attribution === ownAttribution ? "negative" : "neutral";
  }

  return "neutral";
}

function confidenceFor(count) {
  if (count < 3) return { key: "new", label: "New to Titan" };
  if (count < 10) return { key: "limited", label: "Limited history" };
  if (count < 25) return { key: "moderate", label: "Moderate history" };
  return { key: "established", label: "Established history" };
}

function median(values) {
  const rows = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return null;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

function responseHours(event) {
  const minutes = Number(event?.metadata?.response_minutes ?? event?.metadata?.responseMinutes);
  if (Number.isFinite(minutes) && minutes >= 0) return minutes / 60;
  const start = timestamp(event.occurred_at || event.occurredAt);
  const end = timestamp(event.completed_at || event.completedAt);
  if (start && end && end >= start) return (end - start) / 3_600_000;
  return null;
}

export function deriveEngagementSnapshot(events = [], { now = Date.now(), subjectKind = "worker" } = {}) {
  const considered = [];
  let weightedPositive = 0;
  let weightedNegative = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let responded = 0;
  let confirmed = 0;
  let attended = 0;
  let properlyDeclined = 0;
  let properlyRescheduledOrCancelled = 0;
  const responseTimes = [];
  let lastActiveAt = null;

  for (const raw of events || []) {
    const weight = recencyWeight(raw, now);
    if (weight <= 0) continue;
    const classification = classifyEngagementEvent({ ...raw, subject_kind: raw.subject_kind || subjectKind });
    const status = clean(raw.status);
    const at = timestamp(raw.occurred_at || raw.occurredAt || raw.created_at || raw.createdAt);

    if (classification === "positive") {
      weightedPositive += weight;
      positiveCount += 1;
      if (status === "responded") responded += 1;
      if (status === "confirmed") confirmed += 1;
      if (status === "attended") attended += 1;
      if (status === "declined" || status === "not_interested") properlyDeclined += 1;
      if (["candidate_cancelled", "candidate_rescheduled", "employer_cancelled", "employer_rescheduled", "mutually_rescheduled"].includes(status)) properlyRescheduledOrCancelled += 1;
      const hours = responseHours(raw);
      if (hours != null) responseTimes.push(hours);
      if (at && (!lastActiveAt || at > lastActiveAt)) lastActiveAt = at;
    } else if (classification === "negative") {
      weightedNegative += weight;
      negativeCount += 1;
    } else {
      neutralCount += 1;
    }

    considered.push({ ...raw, engagement_classification: classification, engagement_weight: weight });
  }

  const meaningfulCount = positiveCount + negativeCount;
  const confidence = confidenceFor(meaningfulCount);
  const denominator = weightedPositive + weightedNegative;
  const probability = meaningfulCount >= 3 && denominator > 0
    ? Math.max(1, Math.min(99, Math.round((weightedPositive / denominator) * 100)))
    : null;

  return {
    probability,
    probabilityLabel: probability == null ? "New to Titan" : `${probability}% estimated response probability`,
    confidence,
    sampleSize: meaningfulCount,
    positiveCount,
    negativeCount,
    neutralCount,
    stats: {
      responded,
      interviewConfirmations: confirmed,
      interviewAttendance: attended,
      responsibleDeclines: properlyDeclined,
      responsibleReschedulesOrCancellations: properlyRescheduledOrCancelled,
      typicalResponseHours: median(responseTimes),
      lastActiveAt: lastActiveAt ? new Date(lastActiveAt).toISOString() : null,
    },
    events: considered,
    policy: ENGAGEMENT_POLICY,
  };
}
