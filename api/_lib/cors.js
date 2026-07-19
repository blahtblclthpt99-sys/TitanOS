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

export function handleOptions(req, res) {
  applyCors(res, req);
  return res.status(204).end();
}
