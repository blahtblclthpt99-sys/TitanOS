import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { initSentry, captureException } from '@/lib/sentry'
import { hydrateFeatureFlags, refreshFeatureFlagsFromServer } from '@/lib/featureFlags'
import { hydrateLaunchStatus } from '@/lib/launchStatus'
import { trackEvent } from '@/lib/productAnalytics'
import { applyTheme, getStoredTheme, watchSystemContrast } from '@/lib/theme'
import { prefetchHotRoutes, runWhenIdle } from '@/lib/perf'
import '@/index.css'

const CHUNK_RELOAD_KEY = "titanos-chunk-reload";
const CHUNK_RELOAD_TS = "titanos-chunk-reload-at";
const SW_PURGE_KEY = "titanos-sw-v9-purge";

initSentry();
hydrateFeatureFlags();
hydrateLaunchStatus();
trackEvent("app_boot");
runWhenIdle(() => {
  refreshFeatureFlagsFromServer().catch(() => {});
});

function installGlobalErrorLogging() {
  if (typeof window === "undefined") return;
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || "Unhandled promise rejection");
    console.error("[titanos:unhandledrejection]", message, reason);
    captureException(reason instanceof Error ? reason : new Error(message));
  });
  window.addEventListener("error", (event) => {
    if (event.message) {
      console.error("[titanos:window.error]", event.message, event.error || event.filename);
      if (event.error) captureException(event.error);
    }
  });
}

installGlobalErrorLogging();
applyTheme(getStoredTheme());
watchSystemContrast();

function markChunkReloadAttempt() {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    sessionStorage.setItem(CHUNK_RELOAD_TS, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function canAttemptChunkReload() {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_KEY) !== "1";
  } catch {
    return true;
  }
}

function clearChunkReloadFlagWhenHealthy() {
  try {
    const at = Number(sessionStorage.getItem(CHUNK_RELOAD_TS) || 0);
    if (!at) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return;
    }
    if (Date.now() - at > 4000) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      sessionStorage.removeItem(CHUNK_RELOAD_TS);
    }
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault?.();
    if (!canAttemptChunkReload()) return;
    markChunkReloadAttempt();
    window.location.reload();
  });

  window.addEventListener("load", () => {
    window.setTimeout(clearChunkReloadFlagWhenHealthy, 5000);
  });
}

if (typeof window !== "undefined") {
  import("@/lib/capacitor-auth")
    .then((m) => m.installNativeAuthDeepLinks())
    .catch(() => {});
}

function BootProbe({ children }) {
  useEffect(() => {
    const id = window.setTimeout(clearChunkReloadFlagWhenHealthy, 3500);
    return () => window.clearTimeout(id);
  }, []);
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary message="The app failed to load." fullScreen showHome>
    <BootProbe>
      <App />
    </BootProbe>
  </ErrorBoundary>
)

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const isNative = window.Capacitor?.isNativePlatform?.() === true;
  if (!isNative) {
    window.addEventListener('load', () => {
      runWhenIdle(async () => {
        try {
          if (!localStorage.getItem(SW_PURGE_KEY)) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((registration) => registration.unregister()));
            if (window.caches?.keys) {
              const keys = await caches.keys();
              await Promise.all(keys.filter((key) => key.startsWith('titanos-shell')).map((key) => caches.delete(key)));
            }
            localStorage.setItem(SW_PURGE_KEY, '1');
          }
        } catch {
          /* cache recovery must never block app boot */
        }
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
        prefetchHotRoutes();
      }, 2500);
    });
  }
}
