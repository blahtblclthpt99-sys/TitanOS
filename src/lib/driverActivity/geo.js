/**
 * Driver Activity Engine — geo helpers (pure, testable).
 * Distances in miles; speeds in mph.
 */

const EARTH_RADIUS_M = 6371000;
const M_PER_MILE = 1609.344;

function toRad(d) {
  return (d * Math.PI) / 180;
}

/** Great-circle distance in meters. */
export function haversineMeters(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
    return 0;
  }
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function metersToMiles(m) {
  return Number(m || 0) / M_PER_MILE;
}

export function milesToMeters(mi) {
  return Number(mi || 0) * M_PER_MILE;
}

/** Speed mph from two points with timestamps (ms). */
export function speedMphBetween(a, b) {
  if (a?.ts == null || b?.ts == null) return 0;
  const dtSec = Math.max(0, (b.ts - a.ts) / 1000);
  if (dtSec < 0.5) return 0;
  const miles = metersToMiles(haversineMeters(a, b));
  return (miles / dtSec) * 3600;
}

export function roundMiles(n, places = 1) {
  const f = 10 ** places;
  return Math.round(Number(n || 0) * f) / f;
}

export function round1(n) {
  return roundMiles(n, 1);
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
