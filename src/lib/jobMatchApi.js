const DEFAULT_MAX_AGE_DAYS = 45;

function normalizedText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function listingTimestamp(job) {
  return job?.posted_at || job?.published_at || job?.created_at || job?.match?.posted_at || null;
}

function parsedTime(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function expiryTime(job) {
  return parsedTime(job?.expires_at || job?.match?.expires_at);
}

function listingTime(job) {
  return parsedTime(listingTimestamp(job));
}

function freshnessState(job, maxAgeDays = DEFAULT_MAX_AGE_DAYS, now = Date.now()) {
  const expires = expiryTime(job);
  if (expires != null && expires < now) return "expired";

  const posted = listingTime(job);
  if (posted == null) return "unknown";
  if (posted > now + 86400000) return "unknown";
  if (now - posted > maxAgeDays * 86400000) return "stale";
  return "fresh";
}

function dedupeKey(job) {
  // Only explicit provider/source identifiers are authoritative identities.
  // A generic local `id` is unique to a row and must not prevent semantic
  // duplicate collapse across separate copies of the same vacancy.
  const sourceId = job?.external_id || job?.source_job_id || job?.match?.source_job_id;
  if (sourceId) {
    const source = normalizedText(
      job?.source_name || job?.source || job?.match?.source_name || job?.match?.source
    );
    return `source:${source}:${String(sourceId)}`;
  }

  const parts = [
    normalizedText(job?.title),
    normalizedText(job?.company_name || job?.company || job?.employer_name),
    normalizedText(job?.city || job?.location),
    normalizedText(job?.state),
  ];
  return parts.some(Boolean) ? `semantic:${parts.join("|")}` : null;
}

export function normalizeJobMatches(matches, { maxAgeDays = DEFAULT_MAX_AGE_DAYS } = {}) {
  const now = Date.now();
  const seen = new Set();
  const result = [];

  for (const raw of Array.isArray(matches) ? matches : []) {
    if (!raw || typeof raw !== "object") continue;

    const freshness = freshnessState(raw, maxAgeDays, now);
    if (freshness === "expired" || freshness === "stale") continue;

    const key = dedupeKey(raw);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    const posted = listingTime(raw);
    result.push({
      ...raw,
      listing_age_days: posted == null ? null : Math.max(0, Math.floor((now - posted) / 86400000)),
      freshness_status: freshness,
      freshness_verified: freshness === "fresh",
    });
  }

  return result;
}

export async function getJobMatches({ includeExternal = true } = {}) {
  // Keep pure normalization helpers importable by the plain Node test runner.
  // The runtime API is loaded only when a live match request is actually made.
  const { api } = await import("../api/apiClient.js");
  const response = await api.functions.invoke("jobMatchesV2", { includeExternal });
  const data = response?.data || {
    matches: [],
    needsProfile: false,
    needsSkills: false,
    internalCount: 0,
    radiusMode: "city_state_fallback",
    external: { requested: false, enabled: false, reason: "unavailable" },
  };

  return {
    ...data,
    matches: normalizeJobMatches(data.matches),
  };
}

export function jobMatchSourceLabel(job) {
  const source = job?.match?.source || job?.source || "titan";
  if (source === "external") return job?.match?.source_name || job?.source_name || "External provider";
  return "TitanOS";
}

export function isExternalJobMatch(job) {
  return (job?.match?.source || job?.source) === "external";
}
