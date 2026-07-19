import { Capacitor } from "@capacitor/core";
import { shouldUseHashRouter } from "@/lib/routing";

/**
 * Canonical public HTTPS origins that must be allow-listed in Supabase Auth.
 * Keep in sync with Vercel / custom domains.
 */
export const AUTH_PUBLIC_ORIGINS = [
  "https://titanos-web.vercel.app",
  "https://titanfieldos.com",
  "http://localhost:5173",
];

export const NATIVE_AUTH_CALLBACK = "com.titanos.myapp://auth/callback";

function withPath(origin, path) {
  const base = origin.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (shouldUseHashRouter() && !Capacitor.isNativePlatform()) {
    return `${base}/#${normalized}`;
  }
  return `${base}${normalized}`;
}

/**
 * OAuth / email redirect URL.
 * - Native app → custom scheme deep link (handled by capacitor-auth.js)
 * - Web → current browser origin (so Vercel / IONOS / custom domains all work)
 * - Fallback → configured VITE_TITANOS_PUBLIC_ORIGIN
 */
export function getAuthRedirectTo(path = "/auth/callback") {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_AUTH_CALLBACK;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    // Prefer the live host the user is actually on
    if (origin.startsWith("http://") || origin.startsWith("https://")) {
      return withPath(origin, path);
    }
  }

  const configured = (import.meta.env.VITE_TITANOS_PUBLIC_ORIGIN || "").replace(/\/$/, "");
  if (configured) {
    return withPath(configured, path);
  }

  return path.startsWith("/") ? path : `/${path}`;
}

/** Redirect URLs to paste into Supabase → Authentication → URL Configuration */
export function getSupabaseRedirectAllowList() {
  const paths = ["/auth/callback", "/reset-password"];
  const https = AUTH_PUBLIC_ORIGINS.flatMap((origin) =>
    paths.map((p) => `${origin.replace(/\/$/, "")}${p}`)
  );
  return [...https, NATIVE_AUTH_CALLBACK];
}
