/**
 * Sync OAuth URL sniffing — no Supabase import (keeps marketing entry light).
 */
export function hasPendingOAuthParams() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const hash = (window.location.hash || "").replace(/^#/, "");
    const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash.includes("=") && !hash.startsWith("/") ? hash : "";
    const hashParams = new URLSearchParams(hashQuery);
    const get = (k) => params.get(k) || hashParams.get(k);
    return Boolean(
      get("code") ||
        (get("access_token") && get("refresh_token")) ||
        get("error_description") ||
        get("error") === "access_denied"
    );
  } catch {
    return false;
  }
}
