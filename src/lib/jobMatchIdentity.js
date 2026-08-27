function text(value) {
  return String(value || "").trim();
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
