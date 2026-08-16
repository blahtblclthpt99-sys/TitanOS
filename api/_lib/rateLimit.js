import { getSupabaseAdmin } from "./supabase.js";

/**
 * Rate limit with durable cross-instance enforcement.
 * Upstash is used when configured; Titan's service-role-only Supabase RPC is the
 * built-in durable fallback. Local/test environments may use process memory.
 */

/** @type {Map<string, number[]>} */
const buckets = new Map();
const MAX_KEYS = 20_000;

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
  if (timestamps.length >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((timestamps[0] + windowMs - now) / 1000)) };
  }
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
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, ttlSec]]),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const count = Number(data?.[0]?.result ?? data?.[0]);
    if (!Number.isFinite(count)) return null;
    return count > limit ? { ok: false, retryAfterSec: ttlSec } : { ok: true };
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

function productionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

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
  if (!mem.ok) return deny(res, mem.retryAfterSec);
  return true;
}

export async function assertRateLimitAsync(req, res, opts = {}) {
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 60;
  const windowMs = Number(opts.windowMs) > 0 ? Number(opts.windowMs) : 60_000;
  const routeKey = opts.key || req.url?.split("?")[0] || "unknown";
  const bucketKey = `${clientIp(req)}::${routeKey}`;

  const remote = (await upstashAllow(bucketKey, limit, windowMs)) || (await supabaseAllow(bucketKey, limit, windowMs));
  if (remote) {
    if (!remote.ok) return deny(res, remote.retryAfterSec);
    return true;
  }

  if (opts.requireDurable && productionRuntime()) return durableUnavailable(res);

  const mem = memoryAllow(bucketKey, limit, windowMs);
  if (!mem.ok) return deny(res, mem.retryAfterSec);
  return true;
}

export function isDurableRateLimitConfigured() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
