import { Capacitor } from "@capacitor/core";

/** Normalize Capacitor / static-host path quirks and compatibility aliases. */
export function normalizeAppPath(pathname = "/") {
  if (!pathname || pathname === "/index.html" || pathname.endsWith("/index.html")) {
    return "/";
  }

  // Titan Auto is the canonical product name and URL. Internally route it through
  // the proven Autopilot page key until the legacy route can be retired safely.
  if (pathname === "/titan-auto") return "/autopilot";

  return pathname;
}

/**
 * Use hash routing inside the Android WebView so clicks never hit missing
 * filesystem routes. Browser (IONOS website) uses normal paths + .htaccess.
 */
export function shouldUseHashRouter() {
  if (import.meta.env.VITE_USE_HASH_ROUTER === "true") return true;
  return Capacitor.isNativePlatform();
}
