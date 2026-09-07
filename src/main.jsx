import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const LEGACY_KEY_PATTERN = /^(titanos-|titan-|second-|driver-|job-|business-)/i;
const CURRENT_KEY_PATTERN = /^titan-attention/i;
const LEGACY_PURGE_MARKER = "titan-attention:legacy-client-state-purged:v1";

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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

scheduleLegacyClientStatePurge();
