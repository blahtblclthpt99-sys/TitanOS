/**
 * Single-flight OAuth/PKCE bootstrap.
 * Handles ?code= on any path (including Site URL `/`) before or during React boot.
 */
import { supabase } from "@/api/supabaseClient";

let inflight = null;
let lastCode = "";

function readAuthParams() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const hash = (window.location.hash || "").replace(/^#/, "");
  const hashParams = new URLSearchParams(
    hash.includes("=") && !hash.startsWith("/") ? hash : hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : ""
  );
  const get = (k) => params.get(k) || hashParams.get(k) || "";
  return {
    code: get("code"),
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    error: get("error_description") || get("error"),
  };
}

export function hasPendingOAuthParams() {
  const p = readAuthParams();
  return Boolean(p.code || (p.accessToken && p.refreshToken) || p.error);
}

function cleanAuthParamsFromUrl() {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  ["code", "state", "error", "error_description", "error_code", "access_token", "refresh_token", "token_type", "expires_in"].forEach(
    (k) => url.searchParams.delete(k)
  );
  // If we were on `/` with only oauth params, stay on `/` (app shell will take over once session exists)
  const path = url.pathname === "/auth/callback" ? "/" : url.pathname;
  window.history.replaceState({}, document.title, `${path}${url.search}${url.hash}`);
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, session?: object | null }>}
 */
export async function completeOAuthFromUrl() {
  const params = readAuthParams();
  if (params.error) {
    return { ok: false, error: params.error };
  }
  if (!params.code && !(params.accessToken && params.refreshToken)) {
    return { ok: false, error: null, session: null };
  }

  if (params.code && lastCode === params.code && !inflight) {
    const { data } = await supabase.auth.getSession();
    return { ok: Boolean(data.session), session: data.session };
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      if (params.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) {
          const { data: existing } = await supabase.auth.getSession();
          if (existing.session) {
            lastCode = params.code;
            cleanAuthParamsFromUrl();
            return { ok: true, session: existing.session };
          }
          // Keep ?code in the URL until AuthCallback shows the error / user retries
          return { ok: false, error: error.message };
        }
        lastCode = params.code;
        cleanAuthParamsFromUrl();
        return { ok: true, session: data.session };
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
      });
      if (error) return { ok: false, error: error.message };
      cleanAuthParamsFromUrl();
      return { ok: true, session: data.session };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
