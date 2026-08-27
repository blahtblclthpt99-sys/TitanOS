import { readCareerPreference, writeCareerPreference } from "./careerPreferenceStorage.js";
import { jobSource, safeExternalJobUrl } from "./jobMatchIdentity.js";

const SAVED_SEARCH_NAME = "saved-searches";
const ALLOWED_SOURCES = new Set(["all", "native", "external"]);
const ALLOWED_SORTS = new Set(["match", "newest", "pay"]);

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function boundedNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export function annualizePay(job) {
  const type = lower(job?.pay_type || job?.compensation_type || "");
  const low = Number(job?.budget_min || job?.salary_min || job?.pay_min || 0);
  const high = Number(job?.budget_max || job?.salary_max || job?.pay_max || low || 0);
  const midpoint = low && high ? (low + high) / 2 : low || high;
  if (!Number.isFinite(midpoint) || midpoint <= 0) return null;
  if (/hour/.test(type)) return Math.round(midpoint * 2080);
  if (/week/.test(type)) return Math.round(midpoint * 52);
  if (/month/.test(type)) return Math.round(midpoint * 12);
  if (/year|annual|salary/.test(type)) return Math.round(midpoint);
  return null;
}

export { safeExternalJobUrl };

export function sourceTrust(job) {
  const external = jobSource(job) === "external";
  if (!external) return { level: "native", label: "TitanOS native", detail: "Posted inside TitanOS" };
  if (safeExternalJobUrl(job)) return { level: "external", label: "External source", detail: "Original HTTPS listing available" };
  return { level: "limited", label: "Source limited", detail: "Verify the employer and listing before applying" };
}

export function filterJobSearch(rows, filters = {}) {
  const queryTokens = lower(filters.query).split(/\s+/).filter(Boolean);
  const company = lower(filters.company);
  const location = lower(filters.location);
  const source = lower(filters.source || "all");
  const minMatch = Math.max(0, Number(filters.minMatch || 0));
  const minAnnual = Math.max(0, Number(filters.minAnnual || 0));

  return (rows || []).filter((job) => {
    const haystack = [job.title, job.description, job.company_name, job.company, job.employer_name, job.city, job.state]
      .map(lower).join(" ");
    if (queryTokens.length && !queryTokens.every((token) => haystack.includes(token))) return false;
    const employer = lower(job.company_name || job.company || job.employer_name);
    if (company && !employer.includes(company)) return false;
    const place = lower([job.city, job.state, job.location].filter(Boolean).join(" "));
    if (location && !place.includes(location)) return false;
    const external = jobSource(job) === "external";
    if (source === "native" && external) return false;
    if (source === "external" && !external) return false;
    if (Number(job?.match?.score || 0) < minMatch) return false;
    const annual = annualizePay(job);
    if (minAnnual && (annual == null || annual < minAnnual)) return false;
    return true;
  });
}

export function sortJobSearch(rows, mode = "match") {
  return [...(rows || [])].sort((a, b) => {
    if (mode === "pay") return (annualizePay(b) || -1) - (annualizePay(a) || -1);
    if (mode === "newest") {
      const bt = Date.parse(b.posted_at || b.created_at || b.published_at || 0) || 0;
      const at = Date.parse(a.posted_at || a.created_at || a.published_at || 0) || 0;
      return bt - at;
    }
    return Number(b?.match?.score || 0) - Number(a?.match?.score || 0);
  });
}

export function buildResumeLink(job) {
  const role = text(job?.title);
  const company = text(job?.company_name || job?.company || job?.employer_name || job?.source_name);
  const description = text(job?.description).slice(0, 10000);
  const params = new URLSearchParams({ role, company, description });
  return `/career/resume?${params.toString()}`;
}

export function normalizeSavedSearchFilters(filters = {}) {
  const source = lower(filters.source || "all");
  const sort = lower(filters.sort || "match");
  return {
    query: text(filters.query).slice(0, 200),
    company: text(filters.company).slice(0, 160),
    location: text(filters.location).slice(0, 160),
    source: ALLOWED_SOURCES.has(source) ? source : "all",
    minMatch: boundedNumber(filters.minMatch, 0, 100),
    minAnnual: boundedNumber(filters.minAnnual, 0, 1000000),
    sort: ALLOWED_SORTS.has(sort) ? sort : "match",
  };
}

function canonicalSearchText(value) {
  return lower(value).replace(/\s+/g, " ");
}

export function savedSearchFingerprint(filters) {
  const normalized = normalizeSavedSearchFilters(filters);
  return JSON.stringify({
    ...normalized,
    query: canonicalSearchText(normalized.query),
    company: canonicalSearchText(normalized.company),
    location: canonicalSearchText(normalized.location),
  });
}

function createSavedSearchId() {
  try {
    if (globalThis.crypto?.randomUUID) return `search_${globalThis.crypto.randomUUID()}`;
  } catch {
    // Fall through to a collision-resistant local fallback.
  }
  return `search_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSavedSearches(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const seenIds = new Set();
  const normalized = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object" || !raw.filters || typeof raw.filters !== "object") continue;
    const filters = normalizeSavedSearchFilters(raw.filters);
    const fingerprint = savedSearchFingerprint(filters);
    if (seen.has(fingerprint)) continue;

    let id = text(raw.id);
    if (!id || seenIds.has(id)) id = createSavedSearchId();
    seen.add(fingerprint);
    seenIds.add(id);

    const createdAt = Number.isFinite(Date.parse(raw.createdAt)) ? new Date(raw.createdAt).toISOString() : null;
    normalized.push({
      id,
      name: text(raw.name).slice(0, 120) || filters.query || filters.location || "Saved search",
      filters,
      createdAt,
    });
    if (normalized.length >= 20) break;
  }

  return normalized;
}

export function loadSavedSearches(userId) {
  if (!userId) return [];
  const parsed = readCareerPreference(userId, SAVED_SEARCH_NAME, []);
  return normalizeSavedSearches(parsed);
}

export function saveSearch(userId, filters, name = "") {
  if (!userId) return [];
  const current = loadSavedSearches(userId);
  const normalizedFilters = normalizeSavedSearchFilters(filters);
  const fingerprint = savedSearchFingerprint(normalizedFilters);
  const item = {
    id: createSavedSearchId(),
    name: text(name).slice(0, 120) || normalizedFilters.query || normalizedFilters.location || "Saved search",
    filters: normalizedFilters,
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...current.filter((entry) => savedSearchFingerprint(entry.filters) !== fingerprint)].slice(0, 20);
  if (!writeCareerPreference(userId, SAVED_SEARCH_NAME, next)) {
    throw new Error("Saved search could not be stored on this device.");
  }
  return next;
}

export function removeSavedSearch(userId, id) {
  if (!userId) return [];
  const current = loadSavedSearches(userId);
  const targetId = text(id);
  const next = current.filter((item) => item.id !== targetId);
  if (next.length === current.length) return current;
  return writeCareerPreference(userId, SAVED_SEARCH_NAME, next) ? next : current;
}
