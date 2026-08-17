import { api } from "@/api/apiClient";
import { listPublishedDrivers } from "@/lib/driverProfilesApi";

const clean = (value) => String(value || "").trim().toLowerCase();
const unique = (values = []) => [...new Set((values || []).map(clean).filter(Boolean))];

function splitDriverLocation(driver = {}) {
  const parts = String(driver.city || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return { city: parts[0] || "", state: parts[1] || "" };
}

function overlap(required = [], owned = []) {
  const need = unique(required);
  const have = new Set(unique(owned));
  if (!need.length) return { ratio: 1, matched: [], missing: [] };
  const matched = need.filter((item) => have.has(item));
  return {
    ratio: matched.length / need.length,
    matched,
    missing: need.filter((item) => !have.has(item)),
  };
}

function locationScore(driver, job) {
  if (clean(job.work_mode) === "remote") return { ratio: 1, reason: "Remote role" };
  const worker = splitDriverLocation(driver);
  const jobCity = clean(job.city);
  const jobState = clean(job.state);
  const workerCity = clean(worker.city);
  const workerState = clean(worker.state);
  if (!jobCity && !jobState) return { ratio: 0.6, reason: "Job location not specified" };
  if (workerCity && jobCity && workerCity === jobCity && (!workerState || !jobState || workerState === jobState)) {
    return { ratio: 1, reason: "Same city" };
  }
  if (workerState && jobState && workerState === jobState) return { ratio: 0.7, reason: "Same state" };
  return { ratio: 0, reason: "Outside listed area" };
}

export function scorePublishedWorkerCandidate(driver = {}, job = {}) {
  const skills = overlap(job.required_skills || [], driver.skills || []);
  const certifications = overlap(job.required_certifications || [], driver.certifications || []);
  const minimumYears = Math.max(0, Number(job.minimum_years_experience || 0) || 0);
  const years = Math.max(0, Number(driver.yearsExperience || 0) || 0);
  const experienceRatio = minimumYears ? Math.min(1, years / minimumYears) : 1;
  const location = locationScore(driver, job);

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        skills.ratio * 45 +
          certifications.ratio * 25 +
          experienceRatio * 15 +
          location.ratio * 15
      )
    )
  );

  const reasons = [];
  if (skills.matched.length) reasons.push(`Skills: ${skills.matched.slice(0, 3).join(", ")}`);
  if (certifications.matched.length) reasons.push(`Credentials: ${certifications.matched.slice(0, 2).join(", ")}`);
  if (minimumYears && experienceRatio >= 1) reasons.push("Meets experience requirement");
  if (location.ratio >= 0.7) reasons.push(location.reason);
  if (driver.availability === "available") reasons.push("Available now");

  const blockers = [];
  if (certifications.missing.length) blockers.push(`Missing required credential: ${certifications.missing.join(", ")}`);
  if (minimumYears && experienceRatio < 1) blockers.push(`Requires ${minimumYears}+ years experience`);

  return { score, reasons, blockers, matched_skills: skills.matched, missing_certifications: certifications.missing };
}

export function rankPublishedWorkerCandidates(drivers = [], job = {}, { minimumScore = 25 } = {}) {
  return (drivers || [])
    .filter((driver) => driver?.published)
    .map((driver) => ({ ...driver, match: scorePublishedWorkerCandidate(driver, job) }))
    .filter((driver) => driver.match.missing_certifications.length === 0)
    .filter((driver) => driver.match.score >= minimumScore)
    .sort((a, b) =>
      b.match.score - a.match.score ||
      Number(b.availability === "available") - Number(a.availability === "available") ||
      Number(b.rating || 0) - Number(a.rating || 0)
    );
}

export async function loadOwnedJobCandidateMatches(userId, jobId) {
  if (!userId || !jobId) throw new Error("A signed-in job owner and job are required.");
  const job = await api.entities.HireJob.get(jobId);
  const ownerId = job?.customer_id || job?.created_by_id;
  if (!job || ownerId !== userId) throw new Error("Only the job owner can view candidate matches.");
  const drivers = await listPublishedDrivers();
  return { job, candidates: rankPublishedWorkerCandidates(drivers, job) };
}
