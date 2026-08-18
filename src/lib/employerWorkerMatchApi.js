import { api } from "@/api/apiClient";
import { listPublishedDrivers } from "@/lib/driverProfilesApi";
import { listPublishedServiceProfiles } from "@/lib/serviceProfilesApi";
import { rankPublishedWorkerMatches } from "@/lib/workerMatch";
import { rankPublishedServiceMatches } from "@/lib/serviceMatch";

/**
 * Business-side opportunity matching.
 *
 * Employment opportunities rank published Job Seeker professional profiles.
 * Contract/customer-request opportunities rank published Service Profiles.
 * The two profile pools never cross. Private worker/search preferences are never
 * queried here, and Engagement is deliberately not imported or used.
 */
export async function loadEmployerWorkerMatches(user, jobId) {
  if (!user?.id) throw new Error("Sign in to view matches.");
  if (!jobId) throw new Error("Choose an opportunity to match people.");

  const job = await api.entities.HireJob.get(jobId);
  if (!job) throw new Error("Opportunity not found.");

  const ownerId = job.customer_id || job.created_by_id;
  if (ownerId && ownerId !== user.id && user.role !== "admin") {
    throw new Error("Only the opportunity owner can view ranked matches.");
  }

  const relationship = String(job.relationship_type || "employment").toLowerCase();
  if (relationship === "employment") {
    const hasPoint = Number.isFinite(Number(job.lat)) && Number.isFinite(Number(job.lng));
    const drivers = await listPublishedDrivers(
      hasPoint ? { viewerLat: Number(job.lat), viewerLng: Number(job.lng) } : {}
    );
    return {
      job,
      profileKind: "employment",
      matches: rankPublishedWorkerMatches(job, drivers, { ownerUserId: user.id }).map((row) => ({ ...row, profileKind: "employment" })),
    };
  }

  if (relationship === "contract" || relationship === "customer_request") {
    const profiles = await listPublishedServiceProfiles();
    return {
      job,
      profileKind: "service",
      matches: rankPublishedServiceMatches(job, profiles, { ownerUserId: user.id }),
    };
  }

  throw new Error("This opportunity type is not supported for matching.");
}
