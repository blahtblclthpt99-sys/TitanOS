import React from "react";
import { hasCachedAuthSession } from "@/lib/sessionPeek";
import { runWhenIdle } from "@/lib/perf";
import { setSentryUser, clearSentryUser } from "@/lib/sentry";
import { persistAndApplyTheme, normalizeThemePref } from "@/lib/theme";

const AUTH_RETRY_ATTEMPTS = 2;
const AUTH_RETRY_DELAY_MS = 800;
/** Hard ceiling so a hung Supabase call never leaves the UI on “Loading TitanOS”. */
const AUTH_BOOT_TIMEOUT_MS = 8000;

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

function userFromSession(session) {
  const authUser = session?.user;
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email || "",
    full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || "",
    role: "user",
    is_pro: false,
    lifetime_premium: false,
    paying_subscriber: false,
    founding_user: false,
    founding_number: null,
    founding_trial_ends_at: null,
    founding_price_lock: null,
    founding_locked_plan: null,
    plan_tier: "",
    account_type: "",
    theme_pref: "system",
  };
}

const AuthContext = React.createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = React.useState(() => hasCachedAuthSession());
  const [isLoadingPublicSettings] = React.useState(false);
  const [authError, setAuthError] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(() => !hasCachedAuthSession());
  const [appPublicSettings] = React.useState({ appName: "TitanOS" });
  const isAuthenticatedRef = React.useRef(false);

  const applyUser = React.useCallback((next) => {
    setUser(next);
    if (next?.id) {
      setSentryUser(next);
      if (next.theme_pref) {
        persistAndApplyTheme(normalizeThemePref(next.theme_pref));
      }
    } else {
      clearSentryUser();
    }
  }, []);

  const markAuthenticated = React.useCallback(
    (nextUser) => {
      applyUser(nextUser);
      isAuthenticatedRef.current = true;
      setIsAuthenticated(true);
    },
    [applyUser]
  );

  const markSignedOut = React.useCallback(() => {
    applyUser(null);
    isAuthenticatedRef.current = false;
    setIsAuthenticated(false);
  }, [applyUser]);

  /** Clear dead tokens so we stop treating storage as a live session. */
  const clearDeadSession = React.useCallback(async () => {
    try {
      const supabase = await loadSupabase();
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
    markSignedOut();
  }, [markSignedOut]);

  const checkUserAuth = React.useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const api = await loadApi();
      const currentUser = await withRetry(() => api.auth.me());
      markAuthenticated(currentUser);
      setAuthError(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("User auth check failed:", error?.status || error?.message || error);
      }

      const status = error?.status;
      let session = null;
      try {
        const supabase = await loadSupabase();
        const { data } = await supabase.auth.getSession();
        session = data?.session ?? null;

        // Expired/invalid access token — try one refresh before giving up.
        if (!session?.user && hasCachedAuthSession()) {
          const refreshed = await supabase.auth.refreshSession();
          session = refreshed?.data?.session ?? null;
        }
      } catch {
        session = null;
      }

      if (session?.user) {
        // Stay signed in from the local session; profile can catch up later.
        if (!isAuthenticatedRef.current) {
          markAuthenticated(userFromSession(session));
        }
        setAuthError({
          type: "auth_degraded",
          message: "Couldn’t refresh your profile. Retrying…",
        });
      } else if (status === 401 || status === 403 || hasCachedAuthSession()) {
        await clearDeadSession();
        setAuthError({
          type: "auth_required",
          message: "Authentication required",
        });
      } else {
        markSignedOut();
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [markAuthenticated, markSignedOut, clearDeadSession]);

  const checkAppState = React.useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    // Fast path: anonymous visitors never download Supabase on first paint
    if (!hasCachedAuthSession()) {
      markSignedOut();
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

      if (data.session?.user) {
        // Hydrate immediately so `/` opens the shell — never bounce to /login.
        markAuthenticated(userFromSession(data.session));
        setAuthChecked(true);
        // Enrich profile without a hard timeout race that undoes auth.
        try {
          await withTimeout(checkUserAuth(), AUTH_BOOT_TIMEOUT_MS, "auth_me_timeout");
        } catch {
          setAuthError({
            type: "auth_degraded",
            message: "Couldn’t finish loading your profile.",
          });
          setIsLoadingAuth(false);
        }
      } else {
        await clearDeadSession();
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("Auth boot failed:", error?.message || error);
      }
      if (hasCachedAuthSession()) {
        // Keep trying via listener; do not mark signed-out or send to login.
        setAuthError({
          type: "auth_degraded",
          message: "Couldn’t finish signing you in. Retrying…",
        });
        setIsLoadingAuth(false);
        setAuthChecked(true);
      } else {
        markSignedOut();
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }
  }, [checkUserAuth, markAuthenticated, markSignedOut, clearDeadSession]);

  React.useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      await checkAppState();
      if (cancelled) return;

      const path = typeof window !== "undefined" ? window.location.pathname : "";
      const onAuthScreen = /\/(login|register|forgot-password|reset-password|auth\/callback)/.test(path);
      const delay = hasCachedAuthSession() || onAuthScreen ? 0 : 2500;
      await new Promise((resolve) => runWhenIdle(resolve, delay));
      if (cancelled) return;

      try {
        const supabase = await loadSupabase();
        if (cancelled) return;
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            if (event === "TOKEN_REFRESHED") return;
            if (event === "INITIAL_SESSION" && isAuthenticatedRef.current) return;
            // Hydrate immediately on sign-in, then enrich.
            if (!isAuthenticatedRef.current) {
              markAuthenticated(userFromSession(session));
            }
            checkUserAuth();
          } else if (event === "SIGNED_OUT") {
            markSignedOut();
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
  }, [checkAppState, checkUserAuth, markAuthenticated, markSignedOut]);

  const logout = React.useCallback(
    async (redirectTo = window.location.href) => {
      markSignedOut();
      setAuthError(null);
      const api = await loadApi();
      if (redirectTo === false) {
        api.auth.logout();
      } else {
        api.auth.logout(redirectTo);
      }
    },
    [markSignedOut]
  );

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
