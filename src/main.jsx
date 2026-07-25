import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { initSentry, captureException } from '@/lib/sentry'
import { applyTheme, getStoredTheme, setStoredTheme, watchSystemContrast } from '@/lib/theme'
import { prefetchHotRoutes, runWhenIdle } from '@/lib/perf'
import '@/index.css'

// Observability — no-ops when VITE_SENTRY_DSN is unset
initSentry();

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

// Restore charcoal dark as the default OS look (one-time after light redesign).
try {
  if (!localStorage.getItem("titanos-theme-dark-restore")) {
    setStoredTheme("dark");
    localStorage.setItem("titanos-theme-dark-restore", "1");
  }
} catch {
  /* ignore */
}

applyTheme(getStoredTheme());
watchSystemContrast();

// Native-only deep links — keep Capacitor plugins out of the web entry chunk
if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) {
  import("@/lib/capacitor-auth")
    .then((m) => m.installNativeAuthDeepLinks())
    .catch(() => {});
}

// Paint immediately — never block first render on auth/network.
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary message="The app failed to load." fullScreen showHome>
    <App />
  </ErrorBoundary>
)

// Progressive Web App — register service worker after load + idle (keep LCP clean)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const isNative = window.Capacitor?.isNativePlatform?.() === true;
  if (!isNative) {
    window.addEventListener('load', () => {
      runWhenIdle(async () => {
        try {
          if (!localStorage.getItem('titanos-sw-v6-purge')) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
            if (window.caches?.keys) {
              const keys = await caches.keys();
              await Promise.all(keys.filter((k) => k.startsWith('titanos-shell')).map((k) => caches.delete(k)));
            }
            localStorage.setItem('titanos-sw-v6-purge', '1');
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
