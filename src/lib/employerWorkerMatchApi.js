import { api } from "@/api/apiClient";
import { listPublishedDrivers } from "@/lib/driverProfilesApi";
import { rankPublishedWorkerMatches } from "@/lib/workerMatch";

/**
 * Employer-side worker matching.
 * Reads only the selected Hire job plus already-published driver profiles.
 * Private worker matching preferences are intentionally not queried here.
 */
export async function loadEmployerWorkerMatches(user, jobId) {
  if (!user?.id) throw new Error("Sign in to view worker matches.");
  if (!jobId) throw new Error("Choose a Hire job to match workers.");

  const job = await api.entities.HireJob.get(jobId);
  if (!job) throw new Error("Hire job not found.");

  const ownerId = job.customer_id || job.created_by_id;
  if (ownerId && ownerId !== user.id && user.role !== "admin") {
    throw new Error("Only the job owner can view ranked worker matches.");
  }

  const hasPoint = Number.isFinite(Number(job.lat)) && Number.isFinite(Number(job.lng));
  const drivers = await listPublishedDrivers(
    hasPoint ? { viewerLat: Number(job.lat), viewerLng: Number(job.lng) } : {}
  );

  return {
    job,
    matches: rankPublishedWorkerMatches(job, drivers, { ownerUserId: user.id }),
  };
}
