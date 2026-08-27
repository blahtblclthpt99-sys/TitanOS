const DEFAULT_MAX_AGE_DAYS = 45;

function normalizedText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function listingTimestamp(job) {
  return job?.posted_at || job?.published_at || job?.created_at || job?.match?.posted_at || null;
}

function isExpired(job, now = Date.now()) {
  const expires = job?.expires_at || job?.match?.expires_at;
  if (!expires) return false;
  const time = Date.parse(expires);
  return Number.isFinite(time) && time < now;
}

function isStale(job, maxAgeDays = DEFAULT_MAX_AGE_DAYS, now = Date.now()) {
  const raw = listingTimestamp(job);
  if (!raw) return false;
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return false;
  return now - time > maxAgeDays * 86400000;
}

function dedupeKey(job) {
  const sourceId = job?.external_id || job?.source_job_id;
  if (sourceId) return `${normalizedText(job?.source_name || job?.source)}:${String(sourceId)}`;
  return [
    normalizedText(job?.title),
    normalizedText(job?.company_name || job?.company || job?.employer_name),
    normalizedText(job?.city),
    normalizedText(job?.state),
  ].join("|");
}

export function normalizeJobMatches(matches, { maxAgeDays = DEFAULT_MAX_AGE_DAYS } = {}) {
  const now = Date.now();
  const seen = new Set();
  const result = [];

  for (const raw of Array.isArray(matches) ? matches : []) {
    if (!raw || isExpired(raw, now) || isStale(raw, maxAgeDays, now)) continue;
    const key = dedupeKey(raw);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    result.push({
      ...raw,
      listing_age_days: listingTimestamp(raw)
        ? Math.max(0, Math.floor((now - Date.parse(listingTimestamp(raw))) / 86400000))
        : null,
      freshness_verified: !isExpired(raw, now) && !isStale(raw, maxAgeDays, now),
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
