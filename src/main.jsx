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

// Observability — crash/perf (Sentry), flags, first-party analytics
initSentry();
hydrateFeatureFlags();
hydrateLaunchStatus();
trackEvent("app_boot");
runWhenIdle(() => {
  refreshFeatureFlagsFromServer().catch(() => {});
});

/** Log uncaught async/sync failures without crashing the shell (ErrorBoundary covers React tree). */
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

// Prefer stored preference (system / light / dark). Default is system when unset.
applyTheme(getStoredTheme());
watchSystemContrast();

/**
 * One-shot chunk recovery after deploy.
 * Do NOT clear the flag at module load (that caused infinite reloads).
 * Clear only after the app has stayed healthy for a few seconds.
 */
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
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return false;
    return true;
  } catch {
    return true;
  }
}

function clearChunkReloadFlagWhenHealthy() {
  try {
    // Only clear if we reloaded recently (within 30s) and stayed up
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

  // After a successful paint + idle, clear the one-shot flag
  window.addEventListener("load", () => {
    window.setTimeout(clearChunkReloadFlagWhenHealthy, 5000);
  });
}

// Native-only deep links — keep Capacitor plugins out of the web entry chunk
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

// Paint immediately — never block first render on auth/network.
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary message="The app failed to load." fullScreen showHome>
    <BootProbe>
      <App />
    </BootProbe>
  </ErrorBoundary>
)

// Progressive Web App — register service worker after load + idle (keep LCP clean)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const isNative = window.Capacitor?.isNativePlatform?.() === true;
  if (!isNative) {
    window.addEventListener('load', () => {
      runWhenIdle(async () => {
        try {
          if (!localStorage.getItem('titanos-sw-v8-purge')) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
            if (window.caches?.keys) {
              const keys = await caches.keys();
              await Promise.all(keys.filter((k) => k.startsWith('titanos-shell')).map((k) => caches.delete(k)));
            }
            localStorage.setItem('titanos-sw-v8-purge', '1');
          }
        } catch {
          /* ignore */
        }
        navigator.serviceWorker.register('/sw.js').catch(() => {});
        prefetchHotRoutes();
      }, 2500);
    });
  }
}
