import React from "react";
import { hasCachedAuthSession } from "@/lib/sessionPeek";
import { runWhenIdle } from "@/lib/perf";

const AUTH_RETRY_ATTEMPTS = 2;
const AUTH_RETRY_DELAY_MS = 800;
/** Hard ceiling so a hung Supabase call never leaves the UI on “Loading TitanOS”. */
const AUTH_BOOT_TIMEOUT_MS = 12000;

function withTimeout(promise, ms, label = "timeout") {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(Object.assign(new Error(label), { status: 408 })), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

async function loadSupabase() {
  const mod = await import("@/api/supabaseClient");
  return mod.supabase;
}

async function loadApi() {
  const mod = await import("@/api/apiClient");
  return mod.api;
}

async function withRetry(task, attempts = AUTH_RETRY_ATTEMPTS) {
  let lastError;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const isAuthFailure = error?.status === 401 || error?.status === 403;
      if (isAuthFailure || i === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, AUTH_RETRY_DELAY_MS * (i + 1)));
    }
  }
  throw lastError;
}

const AuthContext = React.createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = React.useState(true);
  const [isLoadingPublicSettings] = React.useState(false);
  const [authError, setAuthError] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [appPublicSettings] = React.useState({ appName: "TitanOS" });

  const checkUserAuth = React.useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const api = await loadApi();
      const currentUser = await withRetry(() => api.auth.me());
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("User auth check failed:", error?.status || error?.message || error);
      }
      setUser(null);
      setIsAuthenticated(false);
      if (error?.status === 401 || error?.status === 403) {
        setAuthError({
          type: "auth_required",
          message: "Authentication required",
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkAppState = React.useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    // Fast path: anonymous visitors never download Supabase on first paint
    if (!hasCachedAuthSession()) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    try {
      const supabase = await withTimeout(loadSupabase(), AUTH_BOOT_TIMEOUT_MS, "supabase_load_timeout");
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_BOOT_TIMEOUT_MS,
        "session_timeout"
      );
      if (data.session) {
        await withTimeout(checkUserAuth(), AUTH_BOOT_TIMEOUT_MS, "auth_me_timeout");
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("Auth boot failed:", error?.message || error);
      }
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [checkUserAuth]);

  React.useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      await checkAppState();
      if (cancelled) return;

      // Attach auth listener quickly on auth screens; otherwise shortly after idle.
      // A long defer left signed-in users stuck on the marketing page after login.
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      const onAuthScreen = /\/(login|register|forgot-password|reset-password|auth\/callback)/.test(path);
      const delay = hasCachedAuthSession() || onAuthScreen ? 0 : 2500;
      await new Promise((resolve) => runWhenIdle(resolve, delay));
      if (cancelled) return;

      try {
        const supabase = await loadSupabase();
        if (cancelled) return;
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
            checkUserAuth();
          } else {
            setUser(null);
            setIsAuthenticated(false);
            setIsLoadingAuth(false);
            setAuthChecked(true);
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        /* ignore — auth client unavailable */
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [checkAppState, checkUserAuth]);

  const logout = React.useCallback(async (redirectTo = window.location.href) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    const api = await loadApi();
    if (redirectTo === false) {
      api.auth.logout();
    } else {
      api.auth.logout(redirectTo);
    }
  }, []);

  const navigateToLogin = React.useCallback(async () => {
    const api = await loadApi();
    api.auth.redirectToLogin(window.location.href);
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }),
    [
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
