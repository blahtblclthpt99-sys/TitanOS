import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { nativeAuthCallbackRoute } from "@/lib/nativeAuthCallback";

/**
 * When Google OAuth returns to com.titanos.myapp://auth/callback?...
 * close the system browser and route into the SPA hash router.
 *
 * Prefer hash navigation (no full reload) so in-memory auth client + PKCE
 * storage stay intact when the process was not killed.
 */
export function installNativeAuthDeepLinks() {
  if (!Capacitor.isNativePlatform()) return () => {};

  const handleAuthUrl = async (url) => {
    try {
      const route = nativeAuthCallbackRoute(url);
      if (!route) return;

      try {
        await Browser.close();
      } catch {
        // Browser may already be closed
      }

      // Keep the Android WebView on its packaged document and navigate only
      // the hash route. PKCE codes or token fragments are handled by AuthCallback.
      const hashTarget = `#${route}`;
      if (window.location.hash !== hashTarget) {
        window.location.hash = route;
      }
    } catch {
      // ignore malformed deep links
    }
  };

  // A Custom Tab can recreate the Android activity. In that case appUrlOpen
  // may fire before the web bundle registers its listener, so recover the URL
  // that launched the activity as well as listening for warm returns.
  App.getLaunchUrl()
    .then((result) => {
      if (result?.url) return handleAuthUrl(result.url);
      return undefined;
    })
    .catch(() => {});

  const sub = App.addListener("appUrlOpen", ({ url }) => handleAuthUrl(url));

  return () => {
    sub.then((handle) => handle.remove()).catch(() => {});
  };
}
