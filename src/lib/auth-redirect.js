import { Capacitor } from "@capacitor/core";
import { shouldUseHashRouter } from "@/lib/routing";

/** Canonical TitanOS production web origin. */
export const TITANOS_PRODUCTION_ORIGIN = "https://app.titanfieldos.com";

/** Development origins that may be included in the Supabase Auth allow-list. */
export const AUTH_PUBLIC_ORIGINS = ["http://localhost:5173"];

export const NATIVE_AUTH_CALLBACK = "com.titanos.myapp://auth/callback";

function cleanPublicWebOrigin(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const allowedProtocol = parsed.protocol === "https:" || (isLocalhost && parsed.protocol === "http:");
    if (
      !allowedProtocol ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/"
    ) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

function configuredPublicOrigin() {
  return cleanPublicWebOrigin(
    import.meta.env?.VITE_TITANOS_PUBLIC_ORIGIN || TITANOS_PRODUCTION_ORIGIN,
  );
}

function currentPublicOrigin() {
  if (typeof window === "undefined" || !window.location?.origin) return "";
  return cleanPublicWebOrigin(window.location.origin);
}

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
 * - Web → current secure browser origin
 * - Fallback → configured canonical TitanOS production origin
 */
export function getAuthRedirectTo(path = "/auth/callback") {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_AUTH_CALLBACK;
  }

  const liveOrigin = currentPublicOrigin();
  if (liveOrigin) {
    return withPath(liveOrigin, path);
  }

  const configured = configuredPublicOrigin();
  if (configured) {
    return withPath(configured, path);
  }

  return path.startsWith("/") ? path : `/${path}`;
}

/** Redirect URLs to paste into Supabase → Authentication → URL Configuration. */
export function getSupabaseRedirectAllowList() {
  const origins = new Set(AUTH_PUBLIC_ORIGINS);
  const configured = configuredPublicOrigin();
  const liveOrigin = currentPublicOrigin();
  if (configured) origins.add(configured);
  if (liveOrigin) origins.add(liveOrigin);

  // Include site roots: some providers / Site URL configs return ?code= on `/`
  // (PathNormalizer forwards those to /auth/callback).
  const paths = ["/", "/auth/callback", "/reset-password"];
  const urls = [...origins].flatMap((origin) =>
    paths.map((p) => `${origin.replace(/\/$/, "")}${p === "/" ? "" : p}`)
  );
  return [...urls, NATIVE_AUTH_CALLBACK];
}
