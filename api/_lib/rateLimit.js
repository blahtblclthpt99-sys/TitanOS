/**
 * Best-effort in-memory sliding-window rate limit per IP + route.
 * On serverless, each instance has its own map — still useful against burst abuse.
 */

/** @type {Map<string, number[]>} */
const buckets = new Map();

const MAX_KEYS = 20_000;

function clientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) return String(forwarded[0]).trim();
  return (
    req.headers?.["x-real-ip"] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

function pruneStale(timestamps, windowStart) {
  let i = 0;
  while (i < timestamps.length && timestamps[i] < windowStart) i += 1;
  if (i > 0) timestamps.splice(0, i);
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{ limit?: number, windowMs?: number, key?: string }} [opts]
 * @returns {boolean} true if allowed; false if 429 already sent
 */
export function assertRateLimit(req, res, opts = {}) {
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 60;
  const windowMs = Number(opts.windowMs) > 0 ? Number(opts.windowMs) : 60_000;
  const routeKey = opts.key || req.url?.split("?")[0] || "unknown";
  const ip = clientIp(req);
  const bucketKey = `${ip}::${routeKey}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  let timestamps = buckets.get(bucketKey);
  if (!timestamps) {
    if (buckets.size >= MAX_KEYS) {
      // Drop oldest-ish entry (Map insertion order)
      const first = buckets.keys().next().value;
      if (first != null) buckets.delete(first);
    }
    timestamps = [];
    buckets.set(bucketKey, timestamps);
  }

  pruneStale(timestamps, windowStart);

  if (timestamps.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + windowMs - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return false;
  }

  timestamps.push(now);
  return true;
}
