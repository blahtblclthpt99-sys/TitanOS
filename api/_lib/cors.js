/**
 * Shared CORS helpers for Vercel serverless functions (web + Capacitor).
 */
export function applyCors(res, req) {
  const origin = req?.headers?.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin === "null" ? "*" : origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

/**
 * Handle CORS preflight only. Returns true when the request was fully handled.
 * Callers may use: if (handleOptions(req, res)) return;
 */
export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  applyCors(res, req);
  res.status(204).end();
  return true;
}
