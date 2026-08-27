const PREFIX = "titanos_career_v1";

export function careerStorageKey(userId, name) {
  const owner = String(userId || "anonymous").trim() || "anonymous";
  const segment = String(name || "preference").trim().replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  return `${PREFIX}:${owner}:${segment}`;
}

export function readCareerPreference(userId, name, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(careerStorageKey(userId, name));
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeCareerPreference(userId, name, value) {
  if (typeof localStorage === "undefined" || !userId) return false;
  try {
    localStorage.setItem(careerStorageKey(userId, name), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
