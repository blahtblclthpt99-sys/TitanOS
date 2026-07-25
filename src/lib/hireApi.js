import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { locationLabel } from "@/lib/platformConstants";
import { notifyUser } from "@/lib/notify";
import { assertWithinFreeLimit } from "@/lib/plan";
import { DATA_SOURCE, PersistenceError, withSource, getSource } from "@/lib/dataSource";

const PREFIX = "titanos_hire";

function readGlobalApps() {
  return readLocal(PREFIX, "global", "apps", []);
}

function writeGlobalApps(rows) {
  writeLocal(PREFIX, "global", "apps", rows.slice(0, 500));
}

/**
 * Hire board API — Supabase when available.
 * Local fallback is tagged `_source: local` so UI can surface device-only mode
 * instead of looking production-ready.
 */

export async function listHireJobs({ category = "All", state = "", search = "", status = "open" } = {}) {
  try {
    const rows = await api.entities.HireJob.list("-created_date", 200);
    return withSource(filterJobs(rows, { category, state, search, status }), DATA_SOURCE.remote);
  } catch {
    return withSource(
      filterJobs(readLocal(PREFIX, "global", "jobs", []), { category, state, search, status }),
      DATA_SOURCE.local
    );
  }
}

function filterJobs(rows, { category, state, search, status }) {
  const q = search.trim().toLowerCase();
  return rows
    .filter((j) => {
      if (status && status !== "all" && j.status !== status) return false;
      if (category && category !== "All" && j.category !== category) return false;
      if (state && j.state !== state) return false;
      if (!q) return true;
      return (
        j.title?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q) ||
        j.city?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const priority = (job) => (job.is_same_day ? 2 : 0) + (job.is_urgent ? 1 : 0);
      return priority(b) - priority(a);
    });
}

/** Create a hire post (enforces free-plan limits). Prefills from Driver Hub when used there. */
export async function createHireJob(user, data) {
  try {
    const mine = await api.entities.HireJob.filter({ customer_id: user.id, status: "open" });
    assertWithinFreeLimit(user, "hirePosts", mine?.length || 0);
  } catch (error) {
    if (error?.message?.includes("Free plan allows")) throw error;
    const localMine = readLocal(PREFIX, "global", "jobs", []).filter(
      (row) => row.customer_id === user.id && row.status === "open"
    );
    assertWithinFreeLimit(user, "hirePosts", localMine.length);
  }

  const payload = {
    customer_id: user.id,
    customer_name: user.full_name || user.username || "Customer",
    title: data.title.trim(),
    description: data.description?.trim() || "",
    category: data.category || "General",
    city: data.city || user.city || "",
    state: data.state || user.state || "",
    budget_min: Number(data.budget_min) || null,
    budget_max: Number(data.budget_max) || null,
    deadline: data.deadline || null,
    images: data.images || [],
    is_same_day: Boolean(data.is_same_day),
    is_urgent: Boolean(data.is_urgent),
    status: "open",
    application_count: 0,
    created_by_id: user.id,
  };
  try {
    return withSource(await api.entities.HireJob.create(payload), DATA_SOURCE.remote);
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const all = readLocal(PREFIX, "global", "jobs", []);
    all.unshift(row);
    writeLocal(PREFIX, "global", "jobs", all);
    return withSource(row, DATA_SOURCE.local);
  }
}

/** Apply to an open hire post; notifies the poster when possible. */
export async function applyToHireJob(user, hireJobId, { message, bid_amount }) {
  const payload = {
    hire_job_id: hireJobId,
    worker_id: user.id,
    worker_name: user.full_name || user.username || "Worker",
    message: message?.trim() || "",
    bid_amount: Number(bid_amount) || null,
    status: "pending",
    created_by_id: user.id,
  };
  try {
    const app = await api.entities.HireApplication.create(payload);
    try {
      const job = await api.entities.HireJob.get(hireJobId);
      await api.entities.HireJob.update(hireJobId, {
        application_count: (job.application_count || 0) + 1,
      });
      await notifyUser(job.customer_id, {
        type: "applications",
        title: "New job application",
        body: `${payload.worker_name} applied to "${job.title}"`,
        link: "/hire",
      });
    } catch {
      /* optional notify */
    }
    return withSource(app, DATA_SOURCE.remote);
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    writeGlobalApps([row, ...readGlobalApps()]);
    // Keep per-user mirror for "my applications"
    const mine = readLocal(PREFIX, user.id, "apps", []);
    mine.unshift(row);
    writeLocal(PREFIX, user.id, "apps", mine);

    const jobs = readLocal(PREFIX, "global", "jobs", []);
    const jIdx = jobs.findIndex((j) => j.id === hireJobId);
    if (jIdx >= 0) {
      jobs[jIdx] = {
        ...jobs[jIdx],
        application_count: (jobs[jIdx].application_count || 0) + 1,
      };
      writeLocal(PREFIX, "global", "jobs", jobs);
    }
    return withSource(row, DATA_SOURCE.local);
  }
}

export async function listApplicationsForJob(hireJobId) {
  try {
    return withSource(
      await api.entities.HireApplication.filter({ hire_job_id: hireJobId }),
      DATA_SOURCE.remote
    );
  } catch {
    return withSource(
      readGlobalApps().filter((a) => a.hire_job_id === hireJobId),
      DATA_SOURCE.local
    );
  }
}

/** One query for all applicants across a set of posts (avoids N+1 on My Posts). */
export async function listApplicationsForJobs(jobIds) {
  const ids = [...new Set((jobIds || []).filter(Boolean))];
  const empty = Object.fromEntries(ids.map((id) => [id, []]));
  if (!ids.length) return empty;
  try {
    const rows = await api.entities.HireApplication.filter({ hire_job_id: { in: ids } });
    const map = { ...empty };
    for (const row of rows || []) {
      if (!map[row.hire_job_id]) map[row.hire_job_id] = [];
      map[row.hire_job_id].push(row);
    }
    return withSource(map, DATA_SOURCE.remote);
  } catch {
    const map = { ...empty };
    for (const app of readGlobalApps()) {
      if (!map[app.hire_job_id]) continue;
      map[app.hire_job_id].push(app);
    }
    return withSource(map, DATA_SOURCE.local);
  }
}

/** Fetch hire posts by id list — used for Applications tab titles without loading the whole board. */
export async function listHireJobsByIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return withSource([], DATA_SOURCE.remote);
  try {
    return withSource(
      await api.entities.HireJob.filter({ id: { in: unique } }),
      DATA_SOURCE.remote
    );
  } catch {
    const local = readLocal(PREFIX, "global", "jobs", []).filter((job) => unique.includes(job.id));
    return withSource(local, DATA_SOURCE.local);
  }
}

export async function listMyApplications(userId) {
  try {
    return withSource(
      await api.entities.HireApplication.filter({ worker_id: userId }),
      DATA_SOURCE.remote
    );
  } catch {
    const global = readGlobalApps().filter((a) => a.worker_id === userId);
    const mine = readLocal(PREFIX, userId, "apps", []);
    const byId = new Map([...global, ...mine].map((a) => [a.id, a]));
    return withSource([...byId.values()], DATA_SOURCE.local);
  }
}

export async function toggleSaveJob(userId, hireJobId) {
  try {
    const existing = await api.entities.HireSave.filter({ user_id: userId, hire_job_id: hireJobId });
    if (existing.length) {
      await api.entities.HireSave.delete(existing[0].id);
      return false;
    }
    await api.entities.HireSave.create({ user_id: userId, hire_job_id: hireJobId, created_by_id: userId });
    return true;
  } catch {
    const savedIds = readLocal(PREFIX, userId, "saved", []);
    const index = savedIds.indexOf(hireJobId);
    if (index >= 0) {
      savedIds.splice(index, 1);
      writeLocal(PREFIX, userId, "saved", savedIds);
      return false;
    }
    savedIds.push(hireJobId);
    writeLocal(PREFIX, userId, "saved", savedIds);
    return true;
  }
}

export async function listSavedJobIds(userId) {
  if (!userId) return new Set();
  try {
    const rows = await api.entities.HireSave.filter({ user_id: userId });
    return new Set(rows.map((row) => row.hire_job_id));
  } catch {
    return new Set(readLocal(PREFIX, userId, "saved", []));
  }
}

export async function listSavedJobs(userId) {
  const savedIds = await listSavedJobIds(userId);
  if (!savedIds.size) return [];
  const jobs = await listHireJobs({ status: "all" });
  return jobs.filter((job) => savedIds.has(job.id));
}

export async function sendHireMessage(user, { hireJobId, recipientId, body }) {
  const { sendMessage } = await import("@/lib/messagesApi");
  return sendMessage(user, {
    threadId: `hire_${hireJobId}_${[user.id, recipientId].sort().join("_")}`,
    recipientId,
    body,
    type: "text",
    hireJobId,
  });
}

export async function listHireMessages(userId, hireJobId) {
  if (!userId || !hireJobId) return [];
  try {
    // RLS (messages_own) restricts rows to sender/recipient; still filter client-side as defense in depth.
    const rows = await api.entities.MarketplaceMessage.filter({ hire_job_id: hireJobId });
    return (rows || [])
      .filter((message) => message.sender_id === userId || message.recipient_id === userId)
      .sort((a, b) => new Date(a.created_date || a.created_at) - new Date(b.created_date || b.created_at));
  } catch {
    return readLocal(PREFIX, "global", "messages", [])
      .filter(
        (message) =>
          message.hire_job_id === hireJobId &&
          (message.sender_id === userId || message.recipient_id === userId)
      )
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
}

export async function hireApplicant(job, application) {
  // Client-side ownership gate — RLS (019) also blocks applicants from setting accepted.
  try {
    const me = await api.auth.me();
    const ownerId = job?.customer_id || job?.created_by_id;
    if (me?.id && ownerId && me.id !== ownerId && me.role !== "admin") {
      throw new PersistenceError("Only the job owner can hire an applicant.", {
        source: DATA_SOURCE.remote,
        code: "HIRE_FORBIDDEN",
      });
    }
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
  }

  try {
    await api.entities.HireApplication.update(application.id, { status: "accepted" });
    await api.entities.HireJob.update(job.id, {
      status: "hired",
      hired_worker_id: application.worker_id,
    });
    await notifyUser(application.worker_id, {
      type: "hires",
      title: "You're hired!",
      body: `You were hired for "${job.title}"`,
      link: "/hire",
    });
    return withSource({ ok: true, jobId: job.id, applicationId: application.id }, DATA_SOURCE.remote);
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    const apps = readGlobalApps().map((a) =>
      a.id === application.id ? { ...a, status: "accepted" } : a
    );
    writeGlobalApps(apps);
    const jobs = readLocal(PREFIX, "global", "jobs", []);
    const jIdx = jobs.findIndex((j) => j.id === job.id);
    if (jIdx < 0 && getSource(job) !== DATA_SOURCE.local) {
      throw new PersistenceError(
        "Could not hire on the server, and this job is not in device storage.",
        { source: DATA_SOURCE.remote, code: "HIRE_FAIL_CLOSED" }
      );
    }
    if (jIdx >= 0) {
      jobs[jIdx] = { ...jobs[jIdx], status: "hired", hired_worker_id: application.worker_id };
      writeLocal(PREFIX, "global", "jobs", jobs);
    }
    return withSource({ ok: true, jobId: job.id, applicationId: application.id }, DATA_SOURCE.local);
  }
}

export function formatBudget(job) {
  if (job.budget_min && job.budget_max) return `$${job.budget_min}–$${job.budget_max}`;
  if (job.budget_max) return `Up to $${job.budget_max}`;
  if (job.budget_min) return `From $${job.budget_min}`;
  return "Budget flexible";
}

export { locationLabel, getSource, DATA_SOURCE };
