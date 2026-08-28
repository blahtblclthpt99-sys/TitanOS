import { Capacitor } from "@capacitor/core";

function normalizePath(path) {
  const value = String(path || "").trim();
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function normalizeConfiguredBase(value) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return "";
    }
    if (url.username || url.password || url.search || url.hash) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function configuredApiBase() {
  return normalizeConfiguredBase(import.meta.env.VITE_API_BASE_URL);
}

/**
 * Return API candidates in trust order.
 *
 * Browser deployments use their own origin automatically. Native Capacitor
 * builds must receive VITE_API_BASE_URL explicitly; https://localhost is the
 * WebView shell and is never treated as the production API by accident.
 */
export function apiCandidateUrls(path) {
  const normalizedPath = normalizePath(path);
  const urls = [];
  const configured = configuredApiBase();
  if (configured) urls.push(`${configured}${normalizedPath}`);

  if (typeof window !== "undefined" && !Capacitor.isNativePlatform()) {
    const origin = normalizeConfiguredBase(window.location?.origin);
    if (origin) {
      urls.push(`${origin}${normalizedPath}`);
      urls.push(normalizedPath);
    }
  }

  return [...new Set(urls)];
}

export function primaryApiUrl(path) {
  return apiCandidateUrls(path)[0] || "";
}
