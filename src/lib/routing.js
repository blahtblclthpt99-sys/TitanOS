import { Capacitor } from "@capacitor/core";

/** Normalize Capacitor / static-host path quirks like /index.html */
export function normalizeAppPath(pathname = "/") {
  if (!pathname || pathname === "/index.html" || pathname.endsWith("/index.html")) {
    return "/";
  }
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
