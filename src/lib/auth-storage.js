import { Capacitor } from "@capacitor/core";

/**
 * Auth storage for Supabase PKCE.
 * Native: Capacitor Preferences (survives Custom Tab OAuth + process pauses).
 * Web: localStorage (same-tab redirect).
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

function createNativeStorage() {
  // Lazy import so web builds don't require Preferences at call time
  let prefsPromise;
  const prefs = () => {
    if (!prefsPromise) {
      prefsPromise = import("@capacitor/preferences").then((m) => m.Preferences);
    }
    return prefsPromise;
  };

  return {
    async getItem(key) {
      const Preferences = await prefs();
      const { value } = await Preferences.get({ key });
      return value ?? null;
    },
    async setItem(key, value) {
      const Preferences = await prefs();
      await Preferences.set({ key, value });
    },
    async removeItem(key) {
      const Preferences = await prefs();
      await Preferences.remove({ key });
    },
  };
}

export function createAuthStorage() {
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    return createNativeStorage();
  }
  return createWebStorage();
}
