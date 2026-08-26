import { normalizeAppPath } from "@/lib/routing";

const STORAGE_KEY = "titanos_auth_return_to";
const MAX_RETURN_PATH_LENGTH = 500;

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

function unsafeRelativePath(path) {
  return (
    !path ||
    path.length > MAX_RETURN_PATH_LENGTH ||
    path.startsWith("//") ||
    path.startsWith("\\\\") ||
    /[\u0000-\u001F\u007F]/.test(path)
  );
}

/**
 * Resolve a safe in-app path from a Location-like value, absolute URL, or path string.
 */
export function sanitizeReturnPath(raw) {
  if (!raw) return null;

  let path = "";
  if (typeof raw === "string") {
    const value = raw.trim();
    if (!value || unsafeRelativePath(value)) return null;

    try {
      if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        if (typeof window === "undefined" || !window.location?.origin || url.origin !== window.location.origin) {
          return null;
        }
        path = `${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
      } else {
        // Explicitly reject URI schemes instead of turning them into misleading app paths.
        if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return null;
        path = value.startsWith("/") ? value : `/${value}`;
      }
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    path = `${raw.pathname || ""}${raw.search || ""}${raw.hash || ""}`;
  }

  if (unsafeRelativePath(path)) return null;
  path = normalizeAppPath(path) || "/";
  // Strip hash-router noise like /#/jobs → handled by router; keep path only.
  if (path.startsWith("/#")) {
    path = path.slice(2) || "/";
  }
  if (unsafeRelativePath(path)) return null;

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

export function consumeReturnTo(fallback = "/driver") {
  let stored = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return sanitizeReturnPath(stored) || sanitizeReturnPath(fallback) || "/driver";
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
    "/driver";

  if (candidate && candidate !== "/") {
    rememberReturnTo(candidate);
  }

  return candidate;
}
