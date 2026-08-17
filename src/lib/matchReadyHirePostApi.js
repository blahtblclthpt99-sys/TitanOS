import { api } from "@/api/apiClient";
import { createHireJob } from "@/lib/hireApi";
import { DATA_SOURCE, getSource, withSource } from "@/lib/dataSource";

function list(values, max = 30) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].slice(0, max);
}

function coordinate(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export async function createMatchReadyHireJob(user, data = {}) {
  const base = await createHireJob(user, data);
  const requirements = {
    required_skills: list(data.required_skills),
    required_certifications: list(data.required_certifications),
    minimum_years_experience: Math.min(80, Math.max(0, Math.round(Number(data.minimum_years_experience) || 0))),
    employment_type: ["gig", "full_time", "part_time", "contract", "temporary"].includes(data.employment_type) ? data.employment_type : "gig",
    pay_type: ["flat", "hourly", "salary"].includes(data.pay_type) ? data.pay_type : "flat",
    schedule_tags: list(data.schedule_tags, 14),
    work_mode: ["onsite", "remote", "hybrid"].includes(data.work_mode) ? data.work_mode : "onsite",
    lat: coordinate(data.lat, -90, 90),
    lng: coordinate(data.lng, -180, 180),
  };

  if (getSource(base) === DATA_SOURCE.local) {
    return withSource({ ...base, ...requirements }, DATA_SOURCE.local);
  }

  try {
    return withSource(await api.entities.HireJob.update(base.id, requirements), DATA_SOURCE.remote);
  } catch (error) {
    try { await api.entities.HireJob.delete(base.id); } catch { /* rollback best effort */ }
    throw new Error(error?.message || "The job was not posted because matching requirements could not be saved.");
  }
}
