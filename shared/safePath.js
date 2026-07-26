/**
 * Shared path / id sanitizers — used by Vite client and Vercel API.
 * Keep regexes identical; do not fork behavior.
 */

/**
 * Allow only same-app relative paths for deep links.
 * Blocks open redirects, protocol-relative URLs, and external schemes.
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeAppPath(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (!s.startsWith("/")) return "";
  if (s.startsWith("//")) return "";
  if (s.includes("://")) return "";
  if (/[\u0000-\u001F\u007F]/.test(s)) return "";
  if (!/^\/[A-Za-z0-9/_\-.?=&%~]*$/.test(s)) return "";
  if (s.length > 500) return "";
  return s;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}
