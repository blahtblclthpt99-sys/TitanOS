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

function boundedText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function boundedNullableNumber(value, { min = 0, max = 10_000_000 } = {}) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
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

function hasOpenDeadline(job, now = Date.now()) {
  if (!job?.deadline) return true;
  const deadline = Date.parse(job.deadline);
  return Number.isFinite(deadline) && deadline >= now;
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

export function rankInternalJobMatches(jobs = [], driverProfile = {}, { minimumScore = 0, now = Date.now() } = {}) {
  const threshold = Math.max(0, Math.min(100, Number(minimumScore) || 0));
  return (jobs || [])
    .filter((job) => job && (job.status || "open") === "open" && hasOpenDeadline(job, now))
    .map((job) => ({ ...job, match: scoreJobMatch(driverProfile, job) }))
    // Match scores are seeker-side ordering assistance, not eligibility decisions.
    // Only an explicit caller-provided threshold may hide lower-scoring jobs.
    .filter((job) => job.match.score >= threshold)
    .sort((a, b) => b.match.score - a.match.score || Number(Boolean(b.is_urgent)) - Number(Boolean(a.is_urgent)) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

export function normalizeExternalJob(raw = {}, provider = {}) {
  const sourceName = boundedText(provider.name || raw.source_name || "External provider", 120) || "External provider";
  const sourceUrlRaw = boundedText(raw.source_url || raw.url || "", 2048);
  let sourceUrl;
  try {
    const parsed = new URL(sourceUrlRaw);
    if (parsed.protocol !== "https:") throw new Error("protocol");
    sourceUrl = parsed.toString();
  } catch {
    throw new Error("External job source_url must use a valid HTTPS URL.");
  }

  const externalId = boundedText(raw.external_id || raw.id || "", 300);
  if (!externalId) throw new Error("External job requires an external_id.");
  const title = boundedText(raw.title, 300);
  if (!title) throw new Error("External job requires a title.");

  return {
    id: `external:${clean(sourceName)}:${externalId}`,
    external_id: externalId,
    title,
    company_name: boundedText(raw.company_name || raw.company || raw.employer_name, 200),
    description: boundedText(raw.description, 12000),
    category: boundedText(raw.category || "General", 120) || "General",
    city: boundedText(raw.city, 120),
    state: boundedText(raw.state, 120),
    budget_min: boundedNullableNumber(raw.budget_min),
    budget_max: boundedNullableNumber(raw.budget_max),
    required_skills: uniqueStrings(raw.required_skills).slice(0, 100),
    required_certifications: uniqueStrings(raw.required_certifications).slice(0, 100),
    minimum_years_experience: Math.min(80, Math.max(0, Number(raw.minimum_years_experience || 0) || 0)),
    employment_type: boundedText(clean(raw.employment_type), 80),
    pay_type: boundedText(clean(raw.pay_type), 80),
    schedule_tags: uniqueStrings(raw.schedule_tags).slice(0, 50),
    work_mode: boundedText(clean(raw.work_mode), 80),
    posted_at: boundedText(raw.posted_at, 80) || null,
    expires_at: boundedText(raw.expires_at, 80) || null,
    status: "open",
    source: "external",
    source_name: sourceName,
    source_url: sourceUrl,
  };
}

function urlDedupeKey(job = {}) {
  const direct = String(job.source_url || "").trim();
  if (!direct) return "";
  try {
    const parsed = new URL(direct);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ["gclid", "fbclid", "msclkid"].includes(key.toLowerCase())) parsed.searchParams.delete(key);
    }
    return parsed.toString().toLowerCase();
  } catch {
    return clean(direct);
  }
}

function vacancyFingerprint(job = {}) {
  const company = clean(job.company_name || job.company || job.employer_name);
  return [clean(job.title), company, clean(job.city), clean(job.state)].join("|");
}

function externalIdentityKey(job = {}) {
  if (clean(job.source) !== "external") return "";
  const sourceName = clean(job.source_name);
  const sourceJobId = clean(job.external_id || job.source_job_id);
  return sourceName && sourceJobId ? `${sourceName}|${sourceJobId}` : "";
}

function isStale(job, now = Date.now()) {
  if (clean(job.source) === "external" && !job.posted_at) return true;
  if (job.expires_at) {
    const expires = Date.parse(job.expires_at);
    if (!Number.isFinite(expires) || expires < now) return true;
  }
  if (job.posted_at) {
    const posted = Date.parse(job.posted_at);
    if (!Number.isFinite(posted)) return true;
    if (posted > now + 1000 * 60 * 60 * 24) return true;
    if (now - posted > 1000 * 60 * 60 * 24 * 45) return true;
  }
  return false;
}

export function mergeRankedJobMatches({ internal = [], external = [], driverProfile = {}, now = Date.now() } = {}) {
  const rankedInternal = rankInternalJobMatches(internal, driverProfile, { now });
  if (!buildWorkerMatchProfile(driverProfile).external_job_search_consent) return rankedInternal;

  const seenUrls = new Set(rankedInternal.map(urlDedupeKey).filter(Boolean));
  const seenVacancies = new Set(rankedInternal.map(vacancyFingerprint).filter(Boolean));
  const seenExternalIdentities = new Set();
  const rankedExternal = external
    .filter((job) => !isStale(job, now))
    .map((job) => ({ ...job, match: scoreJobMatch(driverProfile, job) }))
    // External scores order opportunities only; they are not automated
    // employment eligibility or rejection decisions.
    .filter((job) => {
      const urlKey = urlDedupeKey(job);
      const vacancyKey = vacancyFingerprint(job);
      const identityKey = externalIdentityKey(job);
      if ((identityKey && seenExternalIdentities.has(identityKey)) || (urlKey && seenUrls.has(urlKey)) || (vacancyKey && seenVacancies.has(vacancyKey))) return false;
      if (identityKey) seenExternalIdentities.add(identityKey);
      if (urlKey) seenUrls.add(urlKey);
      if (vacancyKey) seenVacancies.add(vacancyKey);
      return true;
    })
    .sort((a, b) => b.match.score - a.match.score || String(b.posted_at || "").localeCompare(String(a.posted_at || "")));

  return [...rankedInternal, ...rankedExternal];
}
