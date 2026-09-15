import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
);
const NATIVE_AUTH_SCHEME = "com.titanos.myapp:";
const CHUNK_RELOAD_KEY = "titanos-chunk-reload";
const CHUNK_RELOAD_TS = "titanos-chunk-reload-at";

function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function resolveSurface() {
  if (isNativeApp()) return "titanos";

  const explicit = String(import.meta.env.VITE_APP_SURFACE || "").trim().toLowerCase();
  if (explicit === "attention" || explicit === "titanos") return explicit;

  if (typeof window !== "undefined") {
    const host = String(window.location.hostname || "").toLowerCase();
    if (
      host === "titan-os-six.vercel.app" ||
      host.startsWith("titan-os-git-") ||
      host.startsWith("titan-o") ||
      host.includes("titan-attention")
    ) {
      return "attention";
    }
  }

  // TitanOS is the safe default for Product Hunt, native builds, localhost, and
  // unknown preview aliases. The Attention Vercel project should still set
  // VITE_APP_SURFACE=attention so custom/renamed hosts remain deterministic.
  return "titanos";
}

function markNativeDocument() {
  if (typeof document !== "undefined" && isNativeApp()) {
    document.documentElement.classList.add("is-native");
  }
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

        window.location.replace(`${window.location.origin}/`);
      } catch {
        // Authentication remains fail-closed. The user can retry sign-in.
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
    // Native auth is additive; startup remains available for retry/recovery.
  }
}

function markChunkReloadAttempt() {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    sessionStorage.setItem(CHUNK_RELOAD_TS, String(Date.now()));
  } catch {
    // ignore unavailable storage
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
    if (!at || Date.now() - at > 4000) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      sessionStorage.removeItem(CHUNK_RELOAD_TS);
    }
  } catch {
    // ignore unavailable storage
  }
}

function BootProbe({ children }) {
  useEffect(() => {
    const id = window.setTimeout(clearChunkReloadFlagWhenHealthy, 3500);
    return () => window.clearTimeout(id);
  }, []);
  return children;
}

async function bootAttention(root) {
  const [{ default: AttentionSurface }] = await Promise.all([
    import("./AttentionSurface.jsx"),
  ]);

  root.render(
    <React.StrictMode>
      <AttentionSurface />
    </React.StrictMode>
  );
}

async function bootTitanOS(root) {
  await Promise.all([import("./index.css"), import("./native-polish.css")]);

  const [
    { default: App },
    { default: ErrorBoundary },
    sentry,
    featureFlags,
    launchStatus,
    analytics,
    theme,
    perf,
  ] = await Promise.all([
    import("./App.jsx"),
    import("./components/ErrorBoundary.jsx"),
    import("./lib/sentry.js"),
    import("./lib/featureFlags.js"),
    import("./lib/launchStatus.js"),
    import("./lib/productAnalytics.js"),
    import("./lib/theme.js"),
    import("./lib/perf.js"),
  ]);

  const { initSentry, captureException } = sentry;
  const { hydrateFeatureFlags, refreshFeatureFlagsFromServer } = featureFlags;
  const { hydrateLaunchStatus } = launchStatus;
  const { trackEvent } = analytics;
  const { applyTheme, getStoredTheme, watchSystemContrast } = theme;
  const { prefetchHotRoutes, runWhenIdle } = perf;

  initSentry();
  hydrateFeatureFlags();
  hydrateLaunchStatus();
  trackEvent("app_boot");
  runWhenIdle(() => {
    refreshFeatureFlagsFromServer().catch(() => {});
  });

  if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      const message = reason?.message || String(reason || "Unhandled promise rejection");
      console.error("[titanos:unhandledrejection]", message, reason);
      captureException(reason instanceof Error ? reason : new Error(message));
    });
    window.addEventListener("error", (event) => {
      if (!event.message) return;
      console.error("[titanos:window.error]", event.message, event.error || event.filename);
      if (event.error) captureException(event.error);
    });

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

  applyTheme(getStoredTheme());
  watchSystemContrast();

  if (isNativeApp()) {
    void installNativeAuthDeepLinkBridge();
  }

  root.render(
    <ErrorBoundary message="The app failed to load." fullScreen showHome>
      <BootProbe>
        <App />
      </BootProbe>
    </ErrorBoundary>
  );

  if (typeof window !== "undefined" && "serviceWorker" in navigator && !isNativeApp()) {
    window.addEventListener("load", () => {
      runWhenIdle(async () => {
        try {
          if (!localStorage.getItem("titanos-sw-v8-purge")) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((registration) => registration.unregister()));
            if (window.caches?.keys) {
              const keys = await caches.keys();
              await Promise.all(
                keys
                  .filter((key) => key.startsWith("titanos-shell"))
                  .map((key) => caches.delete(key))
              );
            }
            localStorage.setItem("titanos-sw-v8-purge", "1");
          }
        } catch {
          // PWA cleanup is best-effort.
        }
        navigator.serviceWorker.register("/sw.js").catch(() => {});
        prefetchHotRoutes();
      }, 2500);
    });
  }
}

async function boot() {
  markNativeDocument();
  installNativeApiFetchBridge();

  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Titan root element was not found");
  const root = ReactDOM.createRoot(rootElement);

  if (resolveSurface() === "attention") {
    await bootAttention(root);
    return;
  }

  await bootTitanOS(root);
}

void boot().catch((error) => {
  console.error("[titan:boot]", error);
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = '<main style="font-family:system-ui;padding:2rem"><h1>Titan could not start</h1><p>Please refresh and try again.</p></main>';
  }
});
