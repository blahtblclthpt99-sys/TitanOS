export function normalizeSupabaseUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/(rest|auth)\/v1\/?$/i, "").replace(/\/$/, "");
}
