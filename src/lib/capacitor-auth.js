import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

function authRouteFromPath(pathname) {
  if (pathname.startsWith("/callback")) return "/auth/callback";
  if (pathname.startsWith("/reset-password")) return "/reset-password";
  return "";
}

function authParamsFromDeepLink(parsed) {
  const params = new URLSearchParams(parsed.search || "");
  const fragment = (parsed.hash || "").replace(/^#/, "");
  if (fragment && fragment.includes("=")) {
    const fragmentParams = new URLSearchParams(fragment);
    for (const [key, value] of fragmentParams.entries()) {
      if (!params.has(key)) params.set(key, value);
    }
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

/**
 * Handle native auth returns such as:
 * - com.titanos.myapp://auth/callback?code=...
 * - com.titanos.myapp://auth/reset-password?code=...
 *
 * Prefer hash navigation (no full reload) so native auth storage and PKCE
 * verifier state remain available while the recovery/login code is exchanged.
 */
export function installNativeAuthDeepLinks() {
  if (!Capacitor.isNativePlatform()) return () => {};

  const handleAuthUrl = async (url) => {
    try {
      const parsed = new URL(url);
      if (parsed.host !== "auth") return;
      const route = authRouteFromPath(parsed.pathname);
      if (!route) return;

      try {
        await Browser.close();
      } catch {
        // Browser may already be closed
      }

      const query = authParamsFromDeepLink(parsed);
      const hashTarget = `#${route}${query}`;
      if (window.location.hash !== hashTarget) {
        window.location.hash = `${route}${query}`;
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
