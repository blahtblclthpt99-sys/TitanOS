const TOKEN_SPLIT = /[^a-z0-9+#.-]+/i;

export const MATCH_WEIGHTS = Object.freeze({
  skills: 35,
  certifications: 20,
  experience: 10,
  location: 15,
  pay: 10,
  schedule: 5,
  interests: 5,
});

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueStrings(values = []) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

function tokens(value) {
  return uniqueStrings(String(value || "").toLowerCase().split(TOKEN_SPLIT));
}

function overlapScore(required = [], owned = []) {
  const need = uniqueStrings(required);
  const have = new Set(uniqueStrings(owned));
  if (!need.length) return { ratio: 1, matched: [], missing: [] };
  const matched = need.filter((item) => have.has(item));
  const missing = need.filter((item) => !have.has(item));
  return { ratio: matched.length / need.length, matched, missing };
}

function inferredSkillTerms(job = {}) {
  return uniqueStrings([
    ...(job.required_skills || []),
    ...tokens(job.category),
    ...tokens(job.title),
  ]).filter((term) => term.length >= 3);
}

function skillScore(profile, job) {
  const explicit = uniqueStrings(job.required_skills || []);
  if (explicit.length) return overlapScore(explicit, profile.skills);

  const inferred = inferredSkillTerms(job);
  if (!inferred.length || !profile.skills.length) return { ratio: 0.5, matched: [], missing: [] };
  const owned = new Set(profile.skills.flatMap((skill) => [skill, ...tokens(skill)]));
  const matched = inferred.filter((term) => owned.has(term));
  return {
    ratio: Math.min(1, matched.length / Math.max(1, Math.min(inferred.length, 3))),
    matched,
    missing: [],
  };
}

function interestScore(profile, job) {
  const wanted = uniqueStrings(profile.job_interests || []);
  if (!wanted.length) return { ratio: 1, matched: [] };
  const jobTerms = new Set([
    clean(job.category),
    clean(job.title),
    ...tokens(job.category),
    ...tokens(job.title),
  ].filter(Boolean));
  const matched = wanted.filter((interest) => jobTerms.has(interest) || tokens(interest).some((term) => jobTerms.has(term)));
  return { ratio: matched.length ? Math.min(1, matched.length / Math.min(2, wanted.length)) : 0, matched };
}

function locationScore(profile, job) {
  const workerState = clean(profile.state);
  const workerCity = clean(profile.city);
  const jobState = clean(job.state);
  const jobCity = clean(job.city);
  if (clean(job.work_mode) === "remote") return { ratio: 1, reason: "Remote" };
  if (!jobState && !jobCity) return { ratio: 0.6, reason: "Job location not specified" };
  if (workerCity && jobCity && workerCity === jobCity && (!workerState || !jobState || workerState === jobState)) {
    return { ratio: 1, reason: "Same city" };
  }
  if (workerState && jobState && workerState === jobState) return { ratio: 0.7, reason: "Same state" };
  return { ratio: 0, reason: "Outside preferred area" };
}

function payScore(profile, job) {
  const wanted = Number(profile.desired_pay_min || 0);
  if (!wanted) return { ratio: 1, reason: "No minimum pay preference" };
  const max = Number(job.budget_max || job.budget_min || 0);
  if (!max) return { ratio: 0.5, reason: "Pay not specified" };

  const wantedType = clean(profile.desired_pay_type || "any");
  const offeredType = clean(job.pay_type || "");
  const comparable = !offeredType || wantedType === "any" || offeredType === wantedType;
  if (!comparable) return { ratio: 0.5, reason: "Different pay basis" };
  if (max >= wanted) return { ratio: 1, reason: "Meets pay preference" };
  return { ratio: Math.max(0, max / wanted), reason: "Below pay preference" };
}

function scheduleScore(profile, job) {
  const wanted = uniqueStrings(profile.preferred_schedule || []);
  const offered = uniqueStrings(job.schedule_tags || []);
  if (!wanted.length || !offered.length) return { ratio: 1, matched: [] };
  const match = overlapScore(wanted, offered);
  return { ratio: match.ratio, matched: match.matched };
}

export function buildWorkerMatchProfile(driverProfile = {}) {
  return {
    user_id: driverProfile.user_id || driverProfile.userId || null,
    skills: uniqueStrings(driverProfile.skills),
    certifications: uniqueStrings(driverProfile.certifications),
    years_experience: Math.max(0, Number(driverProfile.years_experience ?? driverProfile.yearsExperience ?? 0) || 0),
    city: String(driverProfile.city || "").trim(),
    state: String(driverProfile.state || "").trim(),
    availability: clean(driverProfile.availability),
    job_interests: uniqueStrings(driverProfile.job_interests),
    work_radius_miles: Math.min(500, Math.max(1, Number(driverProfile.work_radius_miles || 50) || 50)),
    desired_pay_min: Math.max(0, Number(driverProfile.desired_pay_min || 0) || 0),
    desired_pay_type: clean(driverProfile.desired_pay_type || "hourly"),
    preferred_schedule: uniqueStrings(driverProfile.preferred_schedule),
    external_job_search_consent: Boolean(driverProfile.external_job_search_consent),
  };
}

export function scoreJobMatch(driverProfile, job = {}) {
  const profile = buildWorkerMatchProfile(driverProfile);
  const skills = skillScore(profile, job);
  const certifications = overlapScore(job.required_certifications || [], profile.certifications);
  const interests = interestScore(profile, job);
  const minimumYears = Math.max(0, Number(job.minimum_years_experience || 0) || 0);
  const experienceRatio = minimumYears ? Math.min(1, profile.years_experience / minimumYears) : 1;
  const location = locationScore(profile, job);
  const pay = payScore(profile, job);
  const schedule = scheduleScore(profile, job);

  const raw =
    skills.ratio * MATCH_WEIGHTS.skills +
    certifications.ratio * MATCH_WEIGHTS.certifications +
    experienceRatio * MATCH_WEIGHTS.experience +
    location.ratio * MATCH_WEIGHTS.location +
    pay.ratio * MATCH_WEIGHTS.pay +
    schedule.ratio * MATCH_WEIGHTS.schedule +
    interests.ratio * MATCH_WEIGHTS.interests;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const reasons = [];
  if (skills.matched.length) reasons.push(`Skills: ${skills.matched.slice(0, 3).join(", ")}`);
  if (certifications.matched.length) reasons.push(`Credentials: ${certifications.matched.slice(0, 2).join(", ")}`);
  if (interests.matched.length) reasons.push(`Matches your interest in ${interests.matched.slice(0, 2).join(", ")}`);
  if (location.ratio >= 0.7) reasons.push(location.reason);
  if (pay.ratio >= 1 && profile.desired_pay_min) reasons.push(pay.reason);
  if (minimumYears && experienceRatio >= 1) reasons.push("Meets experience requirement");

  const blockers = [];
  if (certifications.missing.length) blockers.push(`Listing asks for credential: ${certifications.missing.join(", ")}`);
  if (minimumYears && experienceRatio < 1) blockers.push(`Listing asks for ${minimumYears}+ years experience`);

  return {
    score,
    reasons,
    blockers,
    matched_skills: skills.matched,
    missing_certifications: certifications.missing,
    requirements_advisory: blockers.length > 0,
    source: job.source || "titan",
    source_name: job.source_name || "TitanOS",
    source_url: job.source_url || null,
  };
}

export function rankInternalJobMatches(jobs = [], driverProfile = {}, { minimumScore = 25 } = {}) {
  return (jobs || [])
    .filter((job) => job && (job.status || "open") === "open")
    .map((job) => ({ ...job, match: scoreJobMatch(driverProfile, job) }))
    // Requirements are advisory to the job seeker. TitanOS may rank them but must
    // not silently disqualify a person from seeing a legitimate open opportunity.
    .filter((job) => job.match.score >= minimumScore)
    .sort((a, b) => b.match.score - a.match.score || Number(Boolean(b.is_urgent)) - Number(Boolean(a.is_urgent)) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

export function normalizeExternalJob(raw = {}, provider = {}) {
  const sourceName = String(provider.name || raw.source_name || "External provider").trim();
  const sourceUrl = String(raw.source_url || raw.url || "").trim();
  if (!/^https:\/\//i.test(sourceUrl)) throw new Error("External job source_url must use HTTPS.");
  const externalId = String(raw.external_id || raw.id || "").trim();
  if (!externalId) throw new Error("External job requires an external_id.");
  return {
    id: `external:${clean(sourceName)}:${externalId}`,
    external_id: externalId,
    title: String(raw.title || "").trim(),
    description: String(raw.description || "").trim(),
    category: String(raw.category || "General").trim(),
    city: String(raw.city || "").trim(),
    state: String(raw.state || "").trim(),
    budget_min: raw.budget_min == null ? null : Number(raw.budget_min),
    budget_max: raw.budget_max == null ? null : Number(raw.budget_max),
    required_skills: uniqueStrings(raw.required_skills),
    required_certifications: uniqueStrings(raw.required_certifications),
    minimum_years_experience: Math.max(0, Number(raw.minimum_years_experience || 0) || 0),
    employment_type: clean(raw.employment_type),
    pay_type: clean(raw.pay_type),
    schedule_tags: uniqueStrings(raw.schedule_tags),
    work_mode: clean(raw.work_mode),
    posted_at: raw.posted_at || null,
    expires_at: raw.expires_at || null,
    status: "open",
    source: "external",
    source_name: sourceName,
    source_url: sourceUrl,
  };
}

function urlDedupeKey(job = {}) {
  const direct = clean(job.source_url);
  return direct ? direct.replace(/\?.*$/, "") : "";
}

function vacancyFingerprint(job = {}) {
  return [clean(job.title), clean(job.city), clean(job.state)].join("|");
}

function isStale(job, now = Date.now()) {
  if (job.expires_at && Date.parse(job.expires_at) < now) return true;
  if (job.posted_at) {
    const posted = Date.parse(job.posted_at);
    if (Number.isFinite(posted) && now - posted > 1000 * 60 * 60 * 24 * 45) return true;
  }
  return false;
}

export function mergeRankedJobMatches({ internal = [], external = [], driverProfile = {}, now = Date.now() } = {}) {
  const rankedInternal = rankInternalJobMatches(internal, driverProfile);
  if (!buildWorkerMatchProfile(driverProfile).external_job_search_consent) return rankedInternal;

  const seenUrls = new Set(rankedInternal.map(urlDedupeKey).filter(Boolean));
  const seenVacancies = new Set(rankedInternal.map(vacancyFingerprint).filter(Boolean));
  const rankedExternal = external
    .filter((job) => !isStale(job, now))
    .map((job) => ({ ...job, match: scoreJobMatch(driverProfile, job) }))
    // Keep listing requirements visible as advisory information; do not turn the
    // matching layer into an employment eligibility or automated rejection gate.
    .filter((job) => job.match.score >= 25)
    .filter((job) => {
      const urlKey = urlDedupeKey(job);
      const vacancyKey = vacancyFingerprint(job);
      if ((urlKey && seenUrls.has(urlKey)) || (vacancyKey && seenVacancies.has(vacancyKey))) return false;
      if (urlKey) seenUrls.add(urlKey);
      if (vacancyKey) seenVacancies.add(vacancyKey);
      return true;
    })
    .sort((a, b) => b.match.score - a.match.score);

  return [...rankedInternal, ...rankedExternal];
}
