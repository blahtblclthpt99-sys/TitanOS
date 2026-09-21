export function normalizeSupabaseUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/(rest|auth)\/v1\/?$/i, "").replace(/\/$/, "");
}

/**
 * Return the canonical project ref only for standard hosted Supabase URLs.
 * Custom domains intentionally return an empty string because their underlying
 * project cannot be proven from the hostname alone.
 */
export function standardSupabaseProjectRef(value = "") {
  const normalized = normalizeSupabaseUrl(value);
  if (!normalized) return "";
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (!host.endsWith(".supabase.co")) return "";
    const ref = host.slice(0, -".supabase.co".length);
    return /^[a-z0-9]+$/.test(ref) ? ref : "";
  } catch {
    return "";
  }
}
