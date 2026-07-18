import React from "react";
import { api } from "@/api/apiClient";
import { supabase } from "@/api/supabaseClient";

const AUTH_RETRY_ATTEMPTS = 2;
const AUTH_RETRY_DELAY_MS = 800;

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
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = React.useState(false);
  const [authError, setAuthError] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [appPublicSettings] = React.useState({ appName: "TitanOS" });

  const checkUserAuth = React.useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await withRetry(() => api.auth.me());
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error("User auth check failed:", error);
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

    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await checkUserAuth();
    } else {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [checkUserAuth]);

  React.useEffect(() => {
    checkAppState();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkUserAuth();
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [checkAppState, checkUserAuth]);

  const logout = React.useCallback((redirectTo = window.location.href) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);

    if (redirectTo === false) {
      api.auth.logout();
    } else {
      api.auth.logout(redirectTo);
    }
  }, []);

  const navigateToLogin = React.useCallback(() => {
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
