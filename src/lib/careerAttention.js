import { evaluateAlerts } from "@/lib/employerIntelligence";
import { profileCompleteness } from "@/lib/careerReadiness";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ACTIVE_STAGES = new Set(["applied", "screening", "interview", "offer"]);
const PRIORITY = { urgent: 0, high: 1, normal: 2, low: 3 };

function text(value) { return String(value || "").trim(); }
function parseTime(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
function jobId(job = {}) {
  return text(job.external_id || job.source_job_id || job.id || `${job.title || "job"}:${job.company_name || job.company || ""}`);
}
function listingDeadline(job = {}) {
  return job.expires_at || job.application_deadline || job.deadline || job.match?.expires_at || null;
}
function stageLabel(stage) {
  return text(stage || "application").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function buildCareerAttention({ interactions = [], jobs = [], alerts = [], profile = {}, seenAlertKeys = [] } = {}, now = Date.now()) {
  const items = [];
  const seen = new Set(seenAlertKeys || []);

  for (const row of interactions || []) {
    if (!row || !ACTIVE_STAGES.has(row.state)) continue;
    const ref = text(row.source_job_id || row.id || "application");
    const employer = text(row.source_name) || "Opportunity";
    const interviewAt = parseTime(row.interview_at);
    const followUpAt = parseTime(row.follow_up_at);
    const updatedAt = parseTime(row.updated_at || row.created_at) || now;

    if (interviewAt) {
      const delta = interviewAt - now;
      if (delta >= 0 && delta <= 72 * HOUR) {
        items.push({
          id: `interview:${ref}:${row.interview_at}`,
          kind: "interview",
          priority: delta <= 24 * HOUR ? "urgent" : "high",
          title: delta <= 24 * HOUR ? "Interview coming up" : "Interview preparation due",
          body: `${employer} interview is scheduled within ${Math.max(1, Math.ceil(delta / HOUR))} hours.`,
          link: "/career/pipeline",
          due_at: row.interview_at,
        });
      }
    }

    if (followUpAt) {
      const delta = followUpAt - now;
      if (delta <= 0) {
        items.push({
          id: `followup-due:${ref}:${row.follow_up_at}`,
          kind: "follow_up",
          priority: "urgent",
          title: "Application follow-up due",
          body: `${employer} has a follow-up scheduled for now or earlier. Review it before contacting anyone.`,
          link: "/career/pipeline",
          due_at: row.follow_up_at,
        });
      } else if (delta <= 48 * HOUR) {
        items.push({
          id: `followup-soon:${ref}:${row.follow_up_at}`,
          kind: "follow_up",
          priority: "high",
          title: "Follow-up approaching",
          body: `${employer} follow-up is scheduled within ${Math.max(1, Math.ceil(delta / HOUR))} hours.`,
          link: "/career/pipeline",
          due_at: row.follow_up_at,
        });
      }
    } else if (now - updatedAt >= 5 * DAY && ["applied", "screening"].includes(row.state)) {
      items.push({
        id: `followup-plan:${ref}:${row.state}`,
        kind: "follow_up",
        priority: "normal",
        title: "Consider planning a follow-up",
        body: `${employer} has been in ${stageLabel(row.state)} for at least five days. Decide whether a follow-up is appropriate.`,
        link: "/career/pipeline",
      });
    }
  }

  for (const alert of evaluateAlerts(jobs, alerts)) {
    for (const job of alert.matches || []) {
      const key = `${alert.id || "alert"}:${jobId(job)}`;
      if (seen.has(key)) continue;
      items.push({
        id: `alert:${key}`,
        alert_key: key,
        kind: "new_match",
        priority: Number(job.match?.score || 0) >= 80 ? "high" : "normal",
        title: "New saved-search match",
        body: `${job.title || "Job"}${job.company_name || job.company ? ` · ${job.company_name || job.company}` : ""} matches one of your saved alert rules.`,
        link: "/career/search",
      });
    }
  }

  for (const job of jobs || []) {
    const deadline = listingDeadline(job);
    const time = parseTime(deadline);
    if (!time) continue;
    const delta = time - now;
    if (delta >= 0 && delta <= 72 * HOUR) {
      items.push({
        id: `deadline:${jobId(job)}:${deadline}`,
        kind: "expiring_listing",
        priority: delta <= 24 * HOUR ? "urgent" : "high",
        title: "Job listing closes soon",
        body: `${job.title || "Job"} appears to close within ${Math.max(1, Math.ceil(delta / HOUR))} hours. Verify the deadline at the original source.`,
        link: "/career/search",
        due_at: deadline,
      });
    }
  }

  const completeness = profileCompleteness(profile || {});
  if (completeness.score < 80) {
    const missing = completeness.checks.filter((item) => !item.complete).map((item) => item.label).slice(0, 3);
    items.push({
      id: `profile-readiness:${completeness.score}`,
      kind: "profile",
      priority: completeness.score < 50 ? "high" : "normal",
      title: "Career profile needs attention",
      body: `Profile completeness is ${completeness.score}%. ${missing.length ? `Consider adding: ${missing.join(", ")}.` : "Review your career profile."}`,
      link: "/career/readiness",
    });
  }

  return items.sort((a, b) => {
    const p = (PRIORITY[a.priority] ?? 9) - (PRIORITY[b.priority] ?? 9);
    if (p) return p;
    return (parseTime(a.due_at) || Number.MAX_SAFE_INTEGER) - (parseTime(b.due_at) || Number.MAX_SAFE_INTEGER);
  });
}

export function attentionCounts(items = []) {
  return {
    total: items.length,
    urgent: items.filter((item) => item.priority === "urgent").length,
    interviews: items.filter((item) => item.kind === "interview").length,
    followUps: items.filter((item) => item.kind === "follow_up").length,
    newMatches: items.filter((item) => item.kind === "new_match").length,
  };
}
