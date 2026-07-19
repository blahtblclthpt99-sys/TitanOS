/**
 * Shared CORS helpers for Vercel serverless functions (web + Capacitor).
 * Origins are allowlisted — do not reflect arbitrary Origin with credentials.
 */

const DEFAULT_ALLOWED = [
  "https://titanos-web.vercel.app",
  "https://titanos.app",
  "https://www.titanos.app",
  "https://titanfieldos.com",
  "https://www.titanfieldos.com",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "capacitor://localhost",
  "http://localhost",
];

function allowedOrigins() {
  const extra = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED, ...extra])];
}

export function applyCors(res, req) {
  const origin = req?.headers?.origin || "";
  const allowed = allowedOrigins();
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (!origin) {
    // Non-browser / same-origin / server-to-server
    res.setHeader("Access-Control-Allow-Origin", allowed[0]);
  }
  // Unknown browser origins: omit ACAO (browser blocks). Do not echo Origin.
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Stripe-Signature");
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
