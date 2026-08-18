import { supabase } from "@/api/supabaseClient";

const DEFAULT_MIN_VALIDITY_MS = 120_000;
let refreshInFlight = null;

function accessToken(session) {
  return String(session?.access_token || "").trim() || null;
}

export function sessionValidityMs(session, now = Date.now()) {
  const expiresAtMs = Number(session?.expires_at || 0) * 1000;
  if (!expiresAtMs) return Number.POSITIVE_INFINITY;
  return expiresAtMs - now;
}

export function sessionNeedsRefresh(session, minValidityMs = DEFAULT_MIN_VALIDITY_MS) {
  if (!accessToken(session)) return true;
  return sessionValidityMs(session) <= Math.max(0, Number(minValidityMs) || 0);
}

async function readCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session || null;
}

/**
 * Serialize explicit refreshes so multiple Titan surfaces cannot rotate the
 * same refresh token at once. After a failed refresh, re-read storage because
 * Supabase's own auto-refresh may have completed while this request waited.
 */
export async function refreshSessionSingleFlight() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.error && accessToken(refreshed.data?.session)) {
          return refreshed.data.session;
        }

        const latest = await readCurrentSession();
        return sessionNeedsRefresh(latest, 0) ? null : latest;
      } catch {
        const latest = await readCurrentSession().catch(() => null);
        return sessionNeedsRefresh(latest, 0) ? null : latest;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function getFreshSession({ forceRefresh = false, minValidityMs = DEFAULT_MIN_VALIDITY_MS } = {}) {
  const current = await readCurrentSession();

  if (!forceRefresh && !sessionNeedsRefresh(current, minValidityMs)) {
    return current;
  }

  const refreshed = await refreshSessionSingleFlight();
  if (refreshed) return refreshed;

  // If proactive refresh failed but the current access token still has usable
  // lifetime, keep it. Never return an actually expired token.
  if (!forceRefresh && !sessionNeedsRefresh(current, 0)) return current;
  return null;
}

export async function getFreshAccessToken(options = {}) {
  return accessToken(await getFreshSession(options));
}

export async function ensureFreshSession(options = {}) {
  const session = await getFreshSession(options);
  if (session?.user && accessToken(session)) return session;

  const error = new Error("Your session could not be refreshed. Please sign in again.");
  error.status = 401;
  error.code = "SESSION_REFRESH_REQUIRED";
  throw error;
}
