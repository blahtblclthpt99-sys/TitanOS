/**
 * Auth storage for Supabase PKCE.
 * Web and Capacitor both use the WebView's durable localStorage. Supabase's
 * browser PKCE client expects storage operations to complete synchronously;
 * an async native Preferences bridge can stall signInWithOAuth before the
 * Custom Tab is opened on some Android WebViews.
 */
function createWebStorage() {
  return {
    getItem: (key) => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    },
    setItem: (key, value) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
    },
  };
}

export function createAuthStorage() {
  return createWebStorage();
}
