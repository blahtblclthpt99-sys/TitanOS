function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function unique(values = []) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

function tokens(value) {
  return unique(String(value || "").split(/[^a-z0-9+#.-]+/i));
}

function overlap(required = [], owned = []) {
  const need = unique(required);
  if (!need.length) return { ratio: 1, matched: [], missing: [] };
  const have = new Set(unique(owned).flatMap((item) => [item, ...tokens(item)]));
  const matched = need.filter((item) => have.has(item) || tokens(item).some((token) => have.has(token)));
  return { ratio: matched.length / need.length, matched, missing: need.filter((item) => !matched.includes(item)) };
}

function opportunityTerms(job = {}) {
  return unique([
    ...(job.required_skills || []),
    job.category,
    job.title,
    ...tokens(job.category),
    ...tokens(job.title),
  ]).filter((term) => term.length >= 3);
}

function locationScore(job, profile) {
  if (clean(job.work_mode) === "remote") return { ratio: 1, reason: "Remote opportunity" };
  const city = clean(profile.serviceCity);
  const state = clean(profile.serviceState);
  const jobCity = clean(job.city);
  const jobState = clean(job.state);
  if (city && jobCity === city && (!state || !jobState || state === jobState)) return { ratio: 1, reason: "Opportunity is in service area" };
  if (state && jobState === state) return { ratio: 0.72, reason: "Same state" };
  if (!jobCity && !jobState) return { ratio: 0.6, reason: "Opportunity location not specified" };
  return { ratio: 0.2, reason: "Outside primary service area" };
}

export function scoreServiceProfileForOpportunity(job = {}, serviceProfile = {}) {
  const service = overlap(
    opportunityTerms(job).slice(0, 8),
    [...(serviceProfile.services || []), ...(serviceProfile.skills || [])]
  );
  const credentials = overlap(
    job.required_certifications || [],
    [...(serviceProfile.licenses || []), ...(serviceProfile.certifications || [])]
  );
  const location = locationScore(job, serviceProfile);
  const availability = serviceProfile.availability === "available" ? 1 : serviceProfile.availability === "busy" ? 0.65 : 0;
  const score = Math.max(0, Math.min(100, Math.round(
    service.ratio * 50 + credentials.ratio * 20 + location.ratio * 20 + availability * 10
  )));

  const reasons = [];
  if (service.matched.length) reasons.push(`Services/skills: ${service.matched.slice(0, 3).join(", ")}`);
  if (credentials.matched.length) reasons.push(`Credentials: ${credentials.matched.slice(0, 2).join(", ")}`);
  if (location.ratio >= 0.7) reasons.push(location.reason);
  if (serviceProfile.availability === "available") reasons.push("Currently available");

  const blockers = [];
  if (credentials.missing.length) blockers.push(`Missing required credential: ${credentials.missing.join(", ")}`);

  return {
    score,
    reasons,
    blockers,
    missing_certifications: credentials.missing,
  };
}

export function rankPublishedServiceMatches(job = {}, profiles = [], { minimumScore = 25, ownerUserId = "" } = {}) {
  if (clean(job.relationship_type) !== "contract" && clean(job.relationship_type) !== "customer_request") return [];
  return (profiles || [])
    .filter((profile) => profile?.published && profile?.userId !== ownerUserId && profile?.availability !== "offline")
    .map((profile) => ({
      id: profile.userId,
      profileId: profile.id,
      profileKind: "service",
      name: profile.displayName || profile.businessName || "Independent worker",
      businessName: profile.businessName || "",
      bio: profile.bio || "",
      city: [profile.serviceCity, profile.serviceState].filter(Boolean).join(", "),
      skills: [...new Set([...(profile.services || []), ...(profile.skills || [])])],
      certifications: [...new Set([...(profile.licenses || []), ...(profile.certifications || [])])],
      equipment: profile.equipment || [],
      insured: Boolean(profile.insured),
      availability: profile.availability,
      pricingMode: profile.pricingMode,
      hourlyRate: profile.hourlyRate,
      startingPrice: profile.startingPrice,
      match: scoreServiceProfileForOpportunity(job, profile),
    }))
    .filter((profile) => !profile.match.missing_certifications.length)
    .filter((profile) => profile.match.score >= minimumScore)
    .sort((a, b) => b.match.score - a.match.score || a.name.localeCompare(b.name));
}
