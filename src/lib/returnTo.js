import { normalizeAppPath } from "@/lib/routing";

const STORAGE_KEY = "titanos_auth_return_to";

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

/**
 * Resolve a safe in-app path from a Location-like value, absolute URL, or path string.
 */
export function sanitizeReturnPath(raw) {
  if (!raw) return null;

  let path = "";
  if (typeof raw === "string") {
    try {
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        if (typeof window !== "undefined" && url.origin !== window.location.origin) {
          return null;
        }
        path = `${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
      } else {
        path = raw.startsWith("/") ? raw : `/${raw}`;
      }
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    path = `${raw.pathname || ""}${raw.search || ""}${raw.hash || ""}`;
  }

  path = normalizeAppPath(path) || "/";
  // Strip hash-router noise like /#/jobs → handled by router; keep path only
  if (path.startsWith("/#")) {
    path = path.slice(2) || "/";
  }

  const pathnameOnly = path.split("?")[0].split("#")[0] || "/";
  if (AUTH_PATHS.has(pathnameOnly) || pathnameOnly.startsWith("/auth/")) {
    return "/";
  }

  return path || "/";
}

/** Persist intended destination across OAuth redirects. */
export function rememberReturnTo(raw) {
  const path = sanitizeReturnPath(raw);
  if (!path || path === "/") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return path || "/";
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    /* ignore */
  }
  return path;
}

export function consumeReturnTo(fallback = "/") {
  let stored = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return sanitizeReturnPath(stored) || sanitizeReturnPath(fallback) || "/";
}

export function peekReturnTo() {
  try {
    return sanitizeReturnPath(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Prefer router state.from, then ?from_url=, then sessionStorage.
 */
export function resolveReturnTo(location) {
  const fromState = location?.state?.from;
  const fromQuery =
    typeof window !== "undefined"
      ? new URLSearchParams(location?.search || window.location.search).get("from_url")
      : null;

  const candidate =
    sanitizeReturnPath(fromState) ||
    sanitizeReturnPath(fromQuery) ||
    peekReturnTo() ||
    "/";

  if (candidate && candidate !== "/") {
    rememberReturnTo(candidate);
  }

  return candidate;
}
