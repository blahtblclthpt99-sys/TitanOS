/**
 * Persisted analytics digests — generated on shift/delivery end for Explorer folders.
 */
import { readLocal, writeLocal } from "@/lib/localStore.js";
import {
  buildCoachInsights,
  collectTrips,
  dailySummary,
  detectRushIntensity,
  rushPeriodStats,
  summarizeTrips,
} from "@/lib/driverActivity/intelligence.js";

const PREFIX = "titanos_driver";
const DIGEST_KEY = "analytics_digest";
const DIGEST_TTL_MS = 6 * 60 * 60 * 1000; // 6h fresh window for folders

function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * @returns {object|null}
 */
export function readAnalyticsDigest(userId) {
  if (!userId) return null;
  const raw = readLocal(PREFIX, userId, DIGEST_KEY, null);
  return raw && typeof raw === "object" ? raw : null;
}

export function isDigestFresh(digest, { now = Date.now() } = {}) {
  if (!digest?.generatedAt) return false;
  const t = new Date(digest.generatedAt).getTime();
  return Number.isFinite(t) && now - t < DIGEST_TTL_MS;
}

/**
 * Build + persist digest after a shift ends.
 */
export function generateShiftDigest(userId, endedSession, stops = [], opts = {}) {
  if (!userId || !endedSession) return null;
  const history = Array.isArray(opts.history) ? opts.history : [endedSession];
  const trips = collectTrips(history, null, stops, opts);
  const summary = summarizeTrips(trips);
  const day = dailySummary(trips, todayISO());
  const rush = rushPeriodStats(trips);
  const intensity = detectRushIntensity(trips, new Date());
  const coach = buildCoachInsights(trips, opts).slice(0, 6);
  const idleSec = Number(endedSession.idle_sec || 0);
  const driveSec = Number(endedSession.drive_sec || 0);
  const digest = {
    generatedAt: new Date().toISOString(),
    source: "shift_end",
    sessionId: endedSession.id,
    day: todayISO(),
    summary,
    day,
    rush,
    intensity,
    coach,
    idle: {
      idleSec,
      driveSec,
      idleRatio: driveSec + idleSec > 0 ? Math.round((idleSec / (driveSec + idleSec)) * 100) / 100 : 0,
    },
    tripsDetected: trips.length,
  };
  writeLocal(PREFIX, userId, DIGEST_KEY, digest);
  return digest;
}

/**
 * Merge delivery analytics into digest after DoorDash complete/cancel.
 */
export function generateDeliveryDigest(userId, delivery, opts = {}) {
  if (!userId || !delivery || delivery.status === "active") return null;
  const prev = readAnalyticsDigest(userId) || {};
  const analytics = delivery.analytics || {};
  const classification = delivery.classification || null;
  const deliveries = Array.isArray(prev.recentDeliveries) ? prev.recentDeliveries.slice() : [];
  deliveries.unshift({
    id: delivery.id,
    status: delivery.status,
    orderType: analytics.orderType || delivery.orderTypeLabel,
    classification,
    miles: analytics.totalMiles,
    idleTimeSec: analytics.idleTimeSec,
    rushPeriod: analytics.rushPeriod,
    endedAt: delivery.endedAt,
  });
  const digest = {
    ...prev,
    generatedAt: new Date().toISOString(),
    source: "delivery_end",
    day: todayISO(),
    lastDelivery: deliveries[0],
    recentDeliveries: deliveries.slice(0, 40),
    classification,
  };
  writeLocal(PREFIX, userId, DIGEST_KEY, digest);
  return digest;
}
