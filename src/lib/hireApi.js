import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { locationLabel } from "@/lib/platformConstants";

const PREFIX = "titanos_hire";

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
  });
}

export async function createHireJob(user, data) {
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
      await api.entities.Notification.create({
        user_id: job.customer_id,
        type: "applications",
        title: "New job application",
        body: `${payload.worker_name} applied to "${job.title}"`,
        link: "/hire",
        created_by_id: user.id,
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

export async function hireApplicant(job, application) {
  try {
    await api.entities.HireApplication.update(application.id, { status: "accepted" });
    await api.entities.HireJob.update(job.id, {
      status: "hired",
      hired_worker_id: application.worker_id,
    });
    await api.entities.Notification.create({
      user_id: application.worker_id,
      type: "hires",
      title: "You're hired!",
      body: `You were hired for "${job.title}"`,
      link: "/hire",
      created_by_id: job.customer_id,
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
