/** Detect branded booking hosts like mike.titanos.app → /book/mike */
const RESERVED = new Set([
  "www",
  "app",
  "api",
  "web",
  "mail",
  "admin",
  "portal",
  "titanos-web",
  "localhost",
  "127",
]);

export function resolveBookingSlugFromHost(hostname = "") {
  const host = String(hostname || "")
    .toLowerCase()
    .split(":")[0]
    .trim();
  if (!host) return null;

  // slug.titanos.app or slug.titanfieldos.com
  const m = host.match(/^([a-z0-9][a-z0-9-]{1,62})\.(titanos\.app|titanfieldos\.com)$/i);
  if (m && !RESERVED.has(m[1])) return m[1];

  // Local/dev: slug.localhost
  const local = host.match(/^([a-z0-9][a-z0-9-]{1,62})\.localhost$/i);
  if (local && !RESERVED.has(local[1])) return local[1];

  return null;
}

/** Preferred public booking URL — branded host when on production domain. */
export function brandedBookingUrl(slug) {
  if (!slug) return "";
  if (typeof window === "undefined") return `https://${slug}.titanos.app`;
  const { hostname, origin, protocol } = window.location;
  if (hostname.endsWith("titanos.app") || hostname.endsWith("titanfieldos.com")) {
    const root = hostname.endsWith("titanfieldos.com") ? "titanfieldos.com" : "titanos.app";
    return `${protocol}//${slug}.${root}`;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${slug}.localhost:${window.location.port || "5173"}`;
  }
  return `${origin}/book/${slug}`;
}
