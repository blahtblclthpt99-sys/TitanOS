/**
 * Sync peek at Supabase auth storage so we can route signed-in users
 * to the app shell without flashing the marketing page.
 *
 * Must match `storageKey` in `src/api/supabaseClient.js` — the client uses a
 * custom key (`titanos-auth`), NOT the default `sb-*-auth-token` pattern.
 */
export const AUTH_STORAGE_KEYS = ["titanos-auth", "titanos-auth-native"];

function sessionPayloadLooksValid(raw) {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Boolean(
      parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.user?.id ||
        parsed?.currentSession?.user?.id
    );
  } catch {
    // Non-JSON but non-empty — treat as present (native / edge formats)
    return raw.length > 20;
  }
}

export function hasCachedAuthSession() {
  if (typeof window === "undefined") return false;
  try {
    for (const key of AUTH_STORAGE_KEYS) {
      if (sessionPayloadLooksValid(window.localStorage.getItem(key))) return true;
    }
    // Legacy / default Supabase keys (older builds or other hosts)
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.includes("auth-token")) continue;
      if (sessionPayloadLooksValid(localStorage.getItem(key))) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
