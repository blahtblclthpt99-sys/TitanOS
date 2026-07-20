/**
 * Sync peek at Supabase auth storage so we can route signed-in users
 * to the app shell without flashing the marketing page.
 */
export function hasCachedAuthSession() {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.includes("auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.access_token || parsed?.currentSession?.access_token) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
