import { readCareerPreference, writeCareerPreference } from "./careerPreferenceStorage.js";

const SAVED_SEARCH_NAME = "saved-searches";

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
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

export function sourceTrust(job) {
  const external = (job?.match?.source || job?.source) === "external";
  const sourceUrl = text(job?.source_url || job?.match?.source_url);
  if (!external) return { level: "native", label: "TitanOS native", detail: "Posted inside TitanOS" };
  if (/^https:\/\//i.test(sourceUrl)) return { level: "external", label: "External source", detail: "Original HTTPS listing available" };
  return { level: "limited", label: "Source limited", detail: "Verify the employer and listing before applying" };
}

export function filterJobSearch(rows, filters = {}) {
  const query = lower(filters.query);
  const company = lower(filters.company);
  const location = lower(filters.location);
  const source = lower(filters.source || "all");
  const minMatch = Math.max(0, Number(filters.minMatch || 0));
  const minAnnual = Math.max(0, Number(filters.minAnnual || 0));

  return (rows || []).filter((job) => {
    const haystack = [job.title, job.description, job.company_name, job.company, job.employer_name, job.city, job.state]
      .map(lower).join(" ");
    if (query && !haystack.includes(query)) return false;
    const employer = lower(job.company_name || job.company || job.employer_name);
    if (company && !employer.includes(company)) return false;
    const place = lower([job.city, job.state, job.location].filter(Boolean).join(" "));
    if (location && !place.includes(location)) return false;
    const external = (job?.match?.source || job?.source) === "external";
    if (source === "native" && external) return false;
    if (source === "external" && !external) return false;
    if (Number(job?.match?.score || 0) < minMatch) return false;
    const annual = annualizePay(job);
    if (minAnnual && annual != null && annual < minAnnual) return false;
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

export function loadSavedSearches(userId) {
  if (!userId) return [];
  const parsed = readCareerPreference(userId, SAVED_SEARCH_NAME, []);
  return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
}

export function saveSearch(userId, filters, name = "") {
  if (!userId) return [];
  const current = loadSavedSearches(userId);
  const item = {
    id: `search_${Date.now()}`,
    name: text(name) || text(filters.query) || text(filters.location) || "Saved search",
    filters: {
      query: text(filters.query),
      company: text(filters.company),
      location: text(filters.location),
      source: text(filters.source || "all"),
      minMatch: Number(filters.minMatch || 0),
      minAnnual: Number(filters.minAnnual || 0),
      sort: text(filters.sort || "match"),
    },
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...current].slice(0, 20);
  writeCareerPreference(userId, SAVED_SEARCH_NAME, next);
  return next;
}

export function removeSavedSearch(userId, id) {
  if (!userId) return [];
  const next = loadSavedSearches(userId).filter((item) => item.id !== id);
  writeCareerPreference(userId, SAVED_SEARCH_NAME, next);
  return next;
}
