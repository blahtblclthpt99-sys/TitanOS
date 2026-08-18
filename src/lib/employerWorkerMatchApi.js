import { api } from "@/api/apiClient";
import { listPublishedEmploymentProfiles } from "@/lib/employmentProfilesApi";
import { listPublishedServiceProfiles } from "@/lib/serviceProfilesApi";
import { rankPublishedWorkerMatches } from "@/lib/workerMatch";
import { rankPublishedServiceMatches } from "@/lib/serviceMatch";

/**
 * Business-side opportunity matching.
 *
 * Employment opportunities rank opt-in neutral Employment Profiles.
 * Contract/customer-request opportunities rank opt-in Service Profiles.
 * The two profile pools never cross. Driver/vehicle data, private search/pay
 * preferences, public ratings, and Engagement are deliberately not imported.
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
    const profiles = await listPublishedEmploymentProfiles();
    return {
      job,
      profileKind: "employment",
      matches: rankPublishedWorkerMatches(job, profiles, { ownerUserId: user.id }).map((row) => ({ ...row, profileKind: "employment" })),
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
