import { Capacitor } from "@capacitor/core";
import { shouldUseHashRouter } from "@/lib/routing";

/**
 * OAuth / email redirect URL. Prefer the public web origin so Google and
 * Supabase always land on a real HTTPS host (required for Play testers).
 */
export function getAuthRedirectTo(path = "/auth/callback") {
  const configured = (import.meta.env.VITE_TITANOS_PUBLIC_ORIGIN || "").replace(/\/$/, "");

  if (Capacitor.isNativePlatform()) {
    // Deep link handled by capacitor-auth.js → /#/auth/callback
    return "com.titanos.myapp://auth/callback";
  }

  if (configured) {
    if (shouldUseHashRouter()) return `${configured}/#${path}`;
    return `${configured}${path}`;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    if (shouldUseHashRouter()) return `${window.location.origin}/#${path}`;
    return `${window.location.origin}${path}`;
  }

  return path;
}
