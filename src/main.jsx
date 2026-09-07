import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.jsx";
import "./index.css";

const LEGACY_KEY_PATTERN = /^(titanos-|titan-|second-|driver-|job-|business-)/i;
const CURRENT_KEY_PATTERN = /^titan-attention/i;
const LEGACY_PURGE_MARKER = "titan-attention:legacy-client-state-purged:v1";
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
);
const NATIVE_AUTH_SCHEME = "com.titanos.myapp:";

function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function installNativeApiFetchBridge() {
  if (typeof window === "undefined" || !API_BASE_URL || typeof window.fetch !== "function") return;
  if (!isNativeApp()) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return originalFetch(`${API_BASE_URL}${input}`, init);
    }
    return originalFetch(input, init);
  };
}

function authParam(url, name) {
  const queryValue = url.searchParams.get(name);
  if (queryValue) return queryValue;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  return hash.get(name);
}

function isSupportedNativeAuthUrl(url) {
  return url.protocol === NATIVE_AUTH_SCHEME && url.host === "auth" && url.pathname.startsWith("/callback");
}

async function installNativeAuthDeepLinkBridge() {
  if (typeof window === "undefined" || !isNativeApp() || !SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    const [{ App: CapacitorApp }, { createClient }] = await Promise.all([
      import("@capacitor/app"),
      import("@supabase/supabase-js"),
    ]);
    const authClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    let consuming = false;

    const consume = async (rawUrl) => {
      if (!rawUrl || consuming) return;

      let url;
      try {
        url = new URL(rawUrl);
      } catch {
        return;
      }
      if (!isSupportedNativeAuthUrl(url)) return;

      const errorCode = authParam(url, "error_code") || authParam(url, "error");
      if (errorCode) return;

      const accessToken = authParam(url, "access_token");
      const refreshToken = authParam(url, "refresh_token");
      const code = authParam(url, "code");
      if ((!accessToken || !refreshToken) && !code) return;

      consuming = true;
      try {
        if (accessToken && refreshToken) {
          const { error } = await authClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          const { error } = await authClient.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Reload the packaged app at its clean internal origin. The primary
        // Supabase client then reads the persisted session during normal boot.
        window.location.replace(`${window.location.origin}/`);
      } catch {
        // Authentication remains fail-closed. The user can retry sign-in rather
        // than retaining a partial or unverified native session.
      } finally {
        consuming = false;
      }
    };

    await CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      void consume(url);
    });

    const launch = await CapacitorApp.getLaunchUrl();
    if (launch?.url) void consume(launch.url);
  } catch {
    // Native auth bridge is additive; app startup must not depend on it.
  }
}

function removeLegacyStorageKeys(storage) {
  if (!storage) return;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && LEGACY_KEY_PATTERN.test(key) && !CURRENT_KEY_PATTERN.test(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

async function purgeLegacyClientStateOnce() {
  if (typeof window === "undefined") return;

  try {
    if (localStorage.getItem(LEGACY_PURGE_MARKER) === "1") return;
  } catch {
    // Storage can be unavailable in privacy-restricted contexts; continue best-effort.
  }

  try {
    // Render first. Legacy cache/service-worker cleanup is maintenance work and
    // should not compete with the critical path on every application startup.
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }
    if (window.caches?.keys) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((key) => caches.delete(key)));
    }

    removeLegacyStorageKeys(localStorage);
    removeLegacyStorageKeys(sessionStorage);
    localStorage.setItem(LEGACY_PURGE_MARKER, "1");
  } catch {
    // Cleanup is best-effort; rendering must never depend on it.
  }
}

function scheduleLegacyClientStatePurge() {
  if (typeof window === "undefined") return;
  const run = () => void purgeLegacyClientStateOnce();

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
    return;
  }

  window.setTimeout(run, 0);
}

installNativeApiFetchBridge();
void installNativeAuthDeepLinkBridge();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

scheduleLegacyClientStatePurge();