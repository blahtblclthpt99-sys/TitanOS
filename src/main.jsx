import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { installNativeAuthDeepLinks } from '@/lib/capacitor-auth'
import { applyTheme, getStoredTheme, setStoredTheme, watchSystemContrast } from '@/lib/theme'
import { prefetchHotRoutes, runWhenIdle } from '@/lib/perf'
import '@/index.css'

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
installNativeAuthDeepLinks();

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
          // One-time purge of stale shell caches from earlier deploys (fixes blank/stuck loads).
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
