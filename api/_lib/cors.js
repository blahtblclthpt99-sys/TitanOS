/**
 * Shared CORS helpers for TitanOS server functions (web + Capacitor).
 * Origins are allowlisted — do not reflect arbitrary Origin with credentials.
 */

const DEFAULT_ALLOWED = [
  "https://titanos.app",
  "https://www.titanos.app",
  "https://titanfieldos.com",
  "https://www.titanfieldos.com",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
];

function isTrustedDynamicOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    return url.hostname === "app.base44.com" || url.hostname.endsWith(".base44.app");
  } catch {
    return false;
  }
}

export function allowedOrigins() {
  const extra = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED, ...extra])];
}

/** Resolve a safe app origin for redirects (never trust raw Origin alone). */
export function resolveAppOrigin(req) {
  const origin = String(req?.headers?.origin || "").replace(/\/$/, "");
  const allowed = allowedOrigins();
  if (origin && (allowed.includes(origin) || isTrustedDynamicOrigin(origin))) {
    return origin;
  }
  const configured = String(
    process.env.TITANOS_PUBLIC_ORIGIN ||
      process.env.VITE_TITANOS_PUBLIC_ORIGIN ||
      process.env.VITE_APP_URL ||
      process.env.PUBLIC_APP_URL ||
      ""
  ).replace(/\/$/, "");
  if (configured && (allowed.includes(configured) || isTrustedDynamicOrigin(configured))) {
    return configured;
  }
  // Payment/OAuth callers must handle an empty value as a fail-closed condition.
  return "";
}

export function applyCors(res, req) {
  const origin = String(req?.headers?.origin || "").replace(/\/$/, "");
  const allowed = allowedOrigins();
  if (origin && (allowed.includes(origin) || isTrustedDynamicOrigin(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  // No Origin normally means same-origin navigation/server-to-server. Do not
  // invent an ACAO value. Unknown browser origins intentionally receive none.
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Stripe-Signature, Payment-Receipt"
  );
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Payment-Receipt");
  res.setHeader("Vary", "Origin");
}

/**
 * Handle CORS preflight only. Returns true when the request was fully handled.
 */
export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  applyCors(res, req);
  res.status(204).end();
  return true;
}
