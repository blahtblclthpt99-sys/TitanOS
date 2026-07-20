import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { locationLabel } from "@/lib/platformConstants";
import { notifyUser } from "@/lib/notify";
import { assertWithinFreeLimit } from "@/lib/plan";

const PREFIX = "titanos_hire";

/**
 * Hire board API — Supabase when available, otherwise localStorage.
 * Used by Hire page and Driver Hub “Request driver” flow.
 */

/**
 * @param {{ category?: string, state?: string, search?: string, status?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listHireJobs({ category = "All", state = "", search = "", status = "open" } = {}) {
  try {
    let rows = await api.entities.HireJob.list("-created_date", 200);
    return filterJobs(rows, { category, state, search, status });
  } catch {
    return filterJobs(readLocal(PREFIX, "global", "jobs", []), { category, state, search, status });
  }
}

function filterJobs(rows, { category, state, search, status }) {
  const q = search.trim().toLowerCase();
  return rows.filter((j) => {
    if (status && status !== "all" && j.status !== status) return false;
    if (category && category !== "All" && j.category !== category) return false;
    if (state && j.state !== state) return false;
    if (!q) return true;
    return (
      j.title?.toLowerCase().includes(q) ||
      j.description?.toLowerCase().includes(q) ||
      j.city?.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
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
    return await api.entities.HireJob.create(payload);
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const all = readLocal(PREFIX, "global", "jobs", []);
    all.unshift(row);
    writeLocal(PREFIX, "global", "jobs", all);
    return row;
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
      /* optional */
    }
    return app;
  } catch {
    const apps = readLocal(PREFIX, user.id, "apps", []);
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    apps.unshift(row);
    writeLocal(PREFIX, user.id, "apps", apps);
    return row;
  }
}

export async function listApplicationsForJob(hireJobId) {
  try {
    return await api.entities.HireApplication.filter({ hire_job_id: hireJobId });
  } catch {
    return readLocal(PREFIX, "global", "apps", []).filter((a) => a.hire_job_id === hireJobId);
  }
}

export async function listMyApplications(userId) {
  try {
    return await api.entities.HireApplication.filter({ worker_id: userId });
  } catch {
    return readLocal(PREFIX, userId, "apps", []);
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
  try {
    const rows = await api.entities.MarketplaceMessage.filter({ hire_job_id: hireJobId });
    return rows
      .filter((message) => message.sender_id === userId || message.recipient_id === userId)
      .sort((a, b) => new Date(a.created_date || a.created_at) - new Date(b.created_date || b.created_at));
  } catch {
    return readLocal(PREFIX, "global", "messages", [])
      .filter((message) => message.hire_job_id === hireJobId && (message.sender_id === userId || message.recipient_id === userId))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
}

export async function hireApplicant(job, application) {
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
  } catch {
    /* local mode */
  }
}

export function formatBudget(job) {
  if (job.budget_min && job.budget_max) return `$${job.budget_min}–$${job.budget_max}`;
  if (job.budget_max) return `Up to $${job.budget_max}`;
  if (job.budget_min) return `From $${job.budget_min}`;
  return "Budget flexible";
}

export { locationLabel };
