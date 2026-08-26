import { getSupabaseAdmin } from "./supabase.js";

/**
 * Rate limit with optional durable cross-instance enforcement.
 * Existing async routes keep Upstash -> memory behavior. Routes that explicitly
 * set requireDurable may additionally use Titan's service-role-only Supabase RPC
 * and fail closed in production if no durable backend is reachable.
 */
const buckets = new Map();
const MAX_KEYS = 20_000;
const UPSTASH_FIXED_WINDOW_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {count, ttl}
`;

function clientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded) && forwarded[0]) return String(forwarded[0]).trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}

function pruneStale(timestamps, windowStart) {
  let i = 0;
  while (i < timestamps.length && timestamps[i] < windowStart) i += 1;
  if (i > 0) timestamps.splice(0, i);
}

function memoryAllow(bucketKey, limit, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  let timestamps = buckets.get(bucketKey);
  if (!timestamps) {
    if (buckets.size >= MAX_KEYS) {
      const first = buckets.keys().next().value;
      if (first != null) buckets.delete(first);
    }
    timestamps = [];
    buckets.set(bucketKey, timestamps);
  }
  pruneStale(timestamps, windowStart);
  if (timestamps.length >= limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((timestamps[0] + windowMs - now) / 1000)) };
  timestamps.push(now);
  return { ok: true, retryAfterSec: 0 };
}

async function upstashAllow(bucketKey, limit, windowMs) {
  const base = String(process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!base || !token) return null;
  const key = `rl:${bucketKey}`;
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    // A pipeline that runs INCR + EXPIRE on every request continually extends the
    // window under traffic. EVAL keeps first-increment expiry + count atomic.
    const res = await fetch(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", UPSTASH_FIXED_WINDOW_SCRIPT, "1", key, String(ttlSec)]),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.result;
    const count = Number(Array.isArray(result) ? result[0] : NaN);
    const remainingTtl = Number(Array.isArray(result) ? result[1] : NaN);
    if (!Number.isFinite(count)) return null;
    const retryAfterSec = Number.isFinite(remainingTtl) && remainingTtl > 0 ? remainingTtl : ttlSec;
    return count > limit ? { ok: false, retryAfterSec } : { ok: true, retryAfterSec: 0 };
  } catch {
    return null;
  }
}

async function supabaseAllow(bucketKey, limit, windowMs) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== "boolean") return null;
    return { ok: row.allowed, retryAfterSec: Number(row.retry_after_seconds || 1) };
  } catch {
    return null;
  }
}

function deny(res, retryAfterSec) {
  res.setHeader("Retry-After", String(retryAfterSec || 1));
  res.status(429).json({ error: "Too many requests. Please try again shortly." });
  return false;
}
function productionRuntime() { return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"; }
function durableUnavailable(res) {
  res.setHeader("Retry-After", "60");
  res.status(503).json({ error: "Verification protection is temporarily unavailable. Please try again shortly." });
  return false;
}

export function assertRateLimit(req, res, opts = {}) {
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 60;
  const windowMs = Number(opts.windowMs) > 0 ? Number(opts.windowMs) : 60_000;
  const routeKey = opts.key || req.url?.split("?")[0] || "unknown";
  const mem = memoryAllow(`${clientIp(req)}::${routeKey}`, limit, windowMs);
  return mem.ok ? true : deny(res, mem.retryAfterSec);
}

export async function assertRateLimitAsync(req, res, opts = {}) {
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 60;
  const windowMs = Number(opts.windowMs) > 0 ? Number(opts.windowMs) : 60_000;
  const routeKey = opts.key || req.url?.split("?")[0] || "unknown";
  const bucketKey = `${clientIp(req)}::${routeKey}`;

  let remote = await upstashAllow(bucketKey, limit, windowMs);
  if (!remote && opts.requireDurable) remote = await supabaseAllow(bucketKey, limit, windowMs);
  if (remote) return remote.ok ? true : deny(res, remote.retryAfterSec);
  if (opts.requireDurable && productionRuntime()) return durableUnavailable(res);

  const mem = memoryAllow(bucketKey, limit, windowMs);
  return mem.ok ? true : deny(res, mem.retryAfterSec);
}

export function isDurableRateLimitConfigured() {
  return Boolean((process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY));
}
