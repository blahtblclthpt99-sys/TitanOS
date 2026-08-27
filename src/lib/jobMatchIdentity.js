function text(value) {
  return String(value || "").trim();
}

function boundedText(value, maxLength) {
  return text(value).slice(0, maxLength);
}

export function jobSource(job) {
  return String(job?.match?.source || job?.source || "titan").toLowerCase() === "external" ? "external" : "titan";
}

export function jobSourceName(job) {
  const source = jobSource(job);
  return text(job?.match?.source_name || job?.source_name) || (source === "external" ? "External provider" : "TitanOS");
}

export function jobSourceId(job) {
  const source = jobSource(job);
  const value = source === "external"
    ? (job?.external_id || job?.source_job_id || job?.match?.source_job_id || job?.id)
    : (job?.id || job?.source_job_id || job?.match?.source_job_id);
  return text(value);
}

export function safeExternalJobUrl(job) {
  if (jobSource(job) !== "external") return null;
  const raw = text(job?.source_url || job?.match?.source_url);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function jobInteractionIdentity(job) {
  return {
    source: jobSource(job),
    sourceName: jobSourceName(job),
    sourceJobId: jobSourceId(job),
    sourceUrl: safeExternalJobUrl(job),
  };
}

export function jobOpportunitySnapshot(job) {
  const snapshot = {};
  const title = boundedText(job?.job_title || job?.title, 300);
  const company = boundedText(job?.company_name || job?.company || job?.employer_name, 200);
  const city = boundedText(job?.job_city || job?.city, 120);
  const state = boundedText(job?.job_state || job?.state, 120);

  if (title) snapshot.job_title = title;
  if (company) snapshot.company_name = company;
  if (city) snapshot.job_city = city;
  if (state) snapshot.job_state = state;
  return snapshot;
}

export function jobInteractionKey(job) {
  const { source, sourceName, sourceJobId } = jobInteractionIdentity(job);
  if (!sourceJobId) return "";
  return `${source}:${sourceName.toLowerCase()}:${sourceJobId}`;
}
