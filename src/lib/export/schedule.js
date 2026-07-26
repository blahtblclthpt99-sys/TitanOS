/**
 * Scheduled reports — local cadence while the app is open.
 * Email delivery is not claimed until a server job exists.
 */
import { readLocal, writeLocal, uid } from "@/lib/localStore";

const PREFIX = "titanos_report_sched";

export const SCHEDULE_CADENCES = Object.freeze([
  { id: "daily", label: "Daily", ms: 24 * 60 * 60 * 1000 },
  { id: "weekly", label: "Weekly", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "monthly", label: "Monthly", ms: 30 * 24 * 60 * 60 * 1000 },
]);

function listRaw(userId) {
  return readLocal(PREFIX, userId, "jobs", []);
}

function save(userId, rows) {
  writeLocal(PREFIX, userId, "jobs", rows);
}

export function listScheduledReports(userId) {
  if (!userId) return [];
  return listRaw(userId);
}

export function upsertScheduledReport(userId, job) {
  if (!userId) throw new Error("Sign in required");
  const cadence = SCHEDULE_CADENCES.find((c) => c.id === job.cadence) || SCHEDULE_CADENCES[1];
  const rows = listRaw(userId);
  const id = job.id || uid();
  const next = {
    id,
    moduleId: job.moduleId,
    title: job.title || job.moduleId,
    format: job.format || "csv",
    cadence: cadence.id,
    enabled: job.enabled !== false,
    email: String(job.email || "").trim(),
    created_at: job.created_at || new Date().toISOString(),
    next_at: job.next_at || new Date(Date.now() + cadence.ms).toISOString(),
    last_run_at: job.last_run_at || null,
  };
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  save(userId, rows);
  return next;
}

export function removeScheduledReport(userId, id) {
  if (!userId) return;
  save(
    userId,
    listRaw(userId).filter((r) => r.id !== id)
  );
}

/**
 * Find due jobs. Caller runs export via module registry and advances next_at.
 */
export function popDueScheduledReports(userId) {
  if (!userId) return [];
  const now = Date.now();
  const rows = listRaw(userId);
  const due = [];
  const nextRows = rows.map((job) => {
    if (!job.enabled) return job;
    if (new Date(job.next_at || 0).getTime() > now) return job;
    due.push(job);
    const cadence = SCHEDULE_CADENCES.find((c) => c.id === job.cadence) || SCHEDULE_CADENCES[1];
    return {
      ...job,
      last_run_at: new Date().toISOString(),
      next_at: new Date(now + cadence.ms).toISOString(),
    };
  });
  if (due.length) save(userId, nextRows);
  return due;
}
