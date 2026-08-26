import { Capacitor } from "@capacitor/core";
import { shouldUseHashRouter } from "@/lib/routing";

/**
 * Canonical public HTTPS origins that must be allow-listed in Supabase Auth.
 * Keep in sync with deployed public hosts.
 */
export const AUTH_PUBLIC_ORIGINS = [
  "https://titanos-web.vercel.app",
  "https://titanfieldos.com",
  "http://localhost:5173",
];

export const NATIVE_AUTH_CALLBACK = "com.titanos.myapp://auth/callback";
export const NATIVE_PASSWORD_RESET = "com.titanos.myapp://auth/reset-password";

function withPath(origin, path) {
  const base = origin.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (shouldUseHashRouter() && !Capacitor.isNativePlatform()) {
    return `${base}/#${normalized}`;
  }
  return `${base}${normalized}`;
}

function nativeRedirectFor(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/reset-password" ? NATIVE_PASSWORD_RESET : NATIVE_AUTH_CALLBACK;
}

/**
 * OAuth / email redirect URL.
 * - Native login/signup → custom callback deep link
 * - Native recovery → dedicated reset-password deep link
 * - Web → current browser origin
 * - Fallback → configured VITE_TITANOS_PUBLIC_ORIGIN
 */
export function getAuthRedirectTo(path = "/auth/callback") {
  if (Capacitor.isNativePlatform()) {
    return nativeRedirectFor(path);
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
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
  const paths = ["/", "/auth/callback", "/reset-password"];
  const https = AUTH_PUBLIC_ORIGINS.flatMap((origin) =>
    paths.map((p) => `${origin.replace(/\/$/, "")}${p === "/" ? "" : p}`)
  );
  return [...https, NATIVE_AUTH_CALLBACK, NATIVE_PASSWORD_RESET];
}
