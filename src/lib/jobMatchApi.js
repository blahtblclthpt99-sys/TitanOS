import { api } from "@/api/apiClient";

export async function getJobMatches({ includeExternal = true } = {}) {
  const response = await api.functions.invoke("jobMatchesV2", { includeExternal });
  return response?.data || {
    matches: [],
    needsProfile: false,
    needsSkills: false,
    internalCount: 0,
    radiusMode: "city_state_fallback",
    external: { requested: false, enabled: false, reason: "unavailable" },
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
