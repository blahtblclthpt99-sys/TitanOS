/**
 * Intelligent stop detection — stationary time + low speed + GPS stability.
 * Brief traffic delays should not become delivery stops.
 */

import { haversineMeters, speedMphBetween } from "./geo.js";

export const DEFAULT_STOP_CONFIG = {
  /** mph below this counts toward stationary */
  stopSpeedMph: 2.5,
  /** meters of jitter allowed while "still" */
  stabilityMeters: 35,
  /** ignore short traffic pauses */
  trafficGraceSec: 45,
  /** confirm a potential stop after this stationary duration */
  confirmStopSec: 90,
  /** resume driving when speed exceeds this */
  resumeSpeedMph: 6,
  /** or when displacement from stop origin exceeds this */
  resumeMoveMeters: 55,
};

/**
 * Pure state machine step.
 * @param {object} state - { phase: 'moving'|'potential'|'stopped', stationarySec, origin, openStopId }
 * @param {object} point - { lat, lng, ts, speedMph? }
 * @param {object} prev - previous point
 * @param {object} config
 * @returns {{ state, events: Array<{type, at, lat, lng}> }}
 */
export function stepStopDetection(state, point, prev, config = DEFAULT_STOP_CONFIG) {
  const cfg = { ...DEFAULT_STOP_CONFIG, ...config };
  const next = {
    phase: state?.phase || "moving",
    stationarySec: Number(state?.stationarySec || 0),
    origin: state?.origin || null,
    openStopId: state?.openStopId || null,
  };
  const events = [];

  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return { state: next, events };
  }

  const speed =
    Number.isFinite(point.speedMph)
      ? point.speedMph
      : prev
        ? speedMphBetween(prev, point)
        : 0;

  const dtSec = prev?.ts ? Math.max(0, (point.ts - prev.ts) / 1000) : 0;
  const movedFromOrigin = next.origin
    ? haversineMeters(next.origin, point)
    : 0;

  const isStill =
    speed < cfg.stopSpeedMph &&
    (next.origin == null || movedFromOrigin <= cfg.stabilityMeters);

  if (isStill) {
    if (!next.origin) next.origin = { lat: point.lat, lng: point.lng, ts: point.ts };
    next.stationarySec += dtSec;

    if (next.phase === "moving" && next.stationarySec >= cfg.trafficGraceSec) {
      next.phase = "potential";
      events.push({
        type: "potential_stop",
        at: new Date(point.ts).toISOString(),
        lat: point.lat,
        lng: point.lng,
        stationarySec: next.stationarySec,
      });
    }

    if (
      (next.phase === "potential" || next.phase === "moving") &&
      next.stationarySec >= cfg.confirmStopSec &&
      !next.openStopId
    ) {
      next.phase = "stopped";
      const id = `auto_${point.ts}`;
      next.openStopId = id;
      events.push({
        type: "stop_start",
        id,
        at: new Date(point.ts).toISOString(),
        lat: next.origin?.lat ?? point.lat,
        lng: next.origin?.lng ?? point.lng,
        auto: true,
      });
    }
  } else {
    const resume =
      speed >= cfg.resumeSpeedMph || movedFromOrigin >= cfg.resumeMoveMeters;

    if (resume && next.phase !== "moving") {
      if (next.openStopId) {
        events.push({
          type: "stop_end",
          id: next.openStopId,
          at: new Date(point.ts).toISOString(),
          lat: point.lat,
          lng: point.lng,
          auto: true,
        });
      }
      next.phase = "moving";
      next.stationarySec = 0;
      next.origin = null;
      next.openStopId = null;
    } else if (resume) {
      next.stationarySec = 0;
      next.origin = null;
    }
  }

  return { state: next, events };
}
