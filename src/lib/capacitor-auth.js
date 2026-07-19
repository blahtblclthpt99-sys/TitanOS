import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

/**
 * When Google OAuth returns to com.titanos.myapp://auth/callback?...
 * close the system browser and route into the SPA hash router.
 *
 * Prefer hash navigation (no full reload) so in-memory auth client + PKCE
 * storage stay intact when the process was not killed.
 */
export function installNativeAuthDeepLinks() {
  if (!Capacitor.isNativePlatform()) return () => {};

  const sub = App.addListener("appUrlOpen", async ({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.host === "auth" && parsed.pathname.startsWith("/callback")) {
        try {
          await Browser.close();
        } catch {
          // Browser may already be closed
        }

        const query = parsed.search || "";
        const hashTarget = `#/auth/callback${query}`;

        // Soft navigate when possible (preserves Preferences + JS heap)
        if (window.location.hash !== hashTarget) {
          window.location.hash = `/auth/callback${query}`;
        }
      }
    } catch {
      // ignore malformed deep links
    }
  });

  return () => {
    sub.then((handle) => handle.remove()).catch(() => {});
  };
}
