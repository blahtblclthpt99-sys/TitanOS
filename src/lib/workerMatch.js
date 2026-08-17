const TOKEN_SPLIT = /[^a-z0-9+#.-]+/i;

export const WORKER_MATCH_WEIGHTS = Object.freeze({
  skills: 45,
  certifications: 20,
  experience: 15,
  location: 10,
  availability: 10,
});

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueStrings(values = []) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

function tokens(value) {
  return uniqueStrings(String(value || "").split(TOKEN_SPLIT));
}

function overlap(required = [], owned = []) {
  const need = uniqueStrings(required);
  const have = new Set(uniqueStrings(owned));
  if (!need.length) return { ratio: 1, matched: [], missing: [] };
  const matched = need.filter((item) => have.has(item));
  const missing = need.filter((item) => !have.has(item));
  return { ratio: matched.length / need.length, matched, missing };
}

function parseDriverLocation(driver = {}) {
  const explicitCity = String(driver.city_name || "").trim();
  const explicitState = String(driver.state || "").trim();
  if (explicitCity || explicitState) return { city: explicitCity || String(driver.city || "").trim(), state: explicitState };
  const parts = String(driver.city || driver.location || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return { city: parts[0] || "", state: parts[1] || "" };
}

function skillMatch(job = {}, driver = {}) {
  const explicit = uniqueStrings(job.required_skills || []);
  if (explicit.length) return overlap(explicit, driver.skills || []);

  const inferred = uniqueStrings([
    ...tokens(job.title),
    ...tokens(job.category),
  ]).filter((term) => term.length >= 3);
  if (!inferred.length) return { ratio: 0.6, matched: [], missing: [] };

  const owned = new Set(
    uniqueStrings(driver.skills || []).flatMap((skill) => [skill, ...tokens(skill)])
  );
  const matched = inferred.filter((term) => owned.has(term));
  return {
    ratio: matched.length ? Math.min(1, matched.length / Math.max(1, Math.min(3, inferred.length))) : 0.35,
    matched,
    missing: [],
  };
}

function locationMatch(job = {}, driver = {}) {
  if (clean(job.work_mode) === "remote") return { ratio: 1, reason: "Remote-friendly" };

  const hasJobPoint = Number.isFinite(Number(job.lat)) && Number.isFinite(Number(job.lng));
  const distance = Number(driver.distanceMi);
  if (hasJobPoint && Number.isFinite(distance) && distance >= 0) {
    if (distance <= 25) return { ratio: 1, reason: `${distance.toFixed(1)} mi from job` };
    if (distance <= 50) return { ratio: 0.8, reason: `${distance.toFixed(1)} mi from job` };
    if (distance <= 100) return { ratio: 0.5, reason: `${distance.toFixed(1)} mi from job` };
    return { ratio: 0.1, reason: `${distance.toFixed(1)} mi from job` };
  }

  const worker = parseDriverLocation(driver);
  const jobCity = clean(job.city);
  const jobState = clean(job.state);
  const workerCity = clean(worker.city);
  const workerState = clean(worker.state);
  if (jobCity && workerCity && jobCity === workerCity && (!jobState || !workerState || jobState === workerState)) {
    return { ratio: 1, reason: "Same city" };
  }
  if (jobState && workerState && jobState === workerState) return { ratio: 0.7, reason: "Same state" };
  if (!jobCity && !jobState) return { ratio: 0.6, reason: "Job location not specified" };
  return { ratio: 0.2, reason: "Different area" };
}

export function scoreWorkerMatch(job = {}, driver = {}) {
  const skills = skillMatch(job, driver);
  const certifications = overlap(job.required_certifications || [], driver.certifications || []);
  const minimumYears = Math.max(0, Number(job.minimum_years_experience || 0) || 0);
  const years = Math.max(0, Number(driver.yearsExperience ?? driver.years_experience ?? 0) || 0);
  const experienceRatio = minimumYears ? Math.min(1, years / minimumYears) : 1;
  const location = locationMatch(job, driver);
  const available = clean(driver.availability) === "available";
  const availabilityRatio = available ? 1 : clean(driver.availability) === "busy" ? 0.5 : 0.25;

  const raw =
    skills.ratio * WORKER_MATCH_WEIGHTS.skills +
    certifications.ratio * WORKER_MATCH_WEIGHTS.certifications +
    experienceRatio * WORKER_MATCH_WEIGHTS.experience +
    location.ratio * WORKER_MATCH_WEIGHTS.location +
    availabilityRatio * WORKER_MATCH_WEIGHTS.availability;

  const reasons = [];
  if (skills.matched.length) reasons.push(`Skills: ${skills.matched.slice(0, 3).join(", ")}`);
  if (certifications.matched.length) reasons.push(`Credentials: ${certifications.matched.slice(0, 2).join(", ")}`);
  if (minimumYears && experienceRatio >= 1) reasons.push("Meets experience requirement");
  if (location.ratio >= 0.7) reasons.push(location.reason);
  if (available) reasons.push("Available now");

  const blockers = certifications.missing.map((name) => `Missing required credential: ${name}`);
  if (minimumYears && experienceRatio < 1) blockers.push(`Below ${minimumYears}+ years requested`);

  return {
    score: Math.max(0, Math.min(100, Math.round(raw))),
    reasons,
    blockers,
    matched_skills: skills.matched,
    missing_certifications: certifications.missing,
  };
}

export function rankPublishedWorkerMatches(job = {}, drivers = [], { minimumScore = 25, ownerUserId = null } = {}) {
  return (drivers || [])
    .filter((driver) => driver && driver.published === true)
    .filter((driver) => !ownerUserId || driver.userId !== ownerUserId)
    .map((driver) => ({ ...driver, match: scoreWorkerMatch(job, driver) }))
    .filter((driver) => driver.match.missing_certifications.length === 0)
    .filter((driver) => driver.match.score >= minimumScore)
    .sort((a, b) =>
      b.match.score - a.match.score ||
      Number(b.availability === "available") - Number(a.availability === "available") ||
      Number(b.rating || 0) - Number(a.rating || 0)
    );
}
