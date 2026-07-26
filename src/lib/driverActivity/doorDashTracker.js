/**
 * DoorDash workflow GPS tracker — 1–2s cadence, speed smoothing, drift filter.
 */

import { haversineMeters, metersToMiles, speedMphBetween } from "./geo.js";

const MIN_MOVE_M = 8;
const SPEED_EMA_ALPHA = 0.35;

export function createDoorDashTracker(handlers = {}, options = {}) {
  const cfg = {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 12000,
    ...options,
  };

  let watchId = null;
  let prev = null;
  let miles = 0;
  let smoothedSpeed = 0;
  let trackingMiles = true;
  let lastTs = null;
  let gpsLost = false;

  function emitTelemetry(point) {
    handlers.onTelemetry?.({
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracy,
      speedMph: Math.round(smoothedSpeed * 10) / 10,
      miles: Math.round(miles * 100) / 100,
      ts: point.ts,
      gpsAvailable: true,
    });
  }

  function handlePosition(pos) {
    const coords = pos?.coords;
    if (!coords) return;
    if (gpsLost) {
      gpsLost = false;
      handlers.onGpsRestored?.();
    }

    const point = {
      lat: coords.latitude,
      lng: coords.longitude,
      ts: pos.timestamp || Date.now(),
      accuracy: coords.accuracy,
      rawSpeedMph:
        coords.speed != null && Number.isFinite(coords.speed)
          ? Math.max(0, coords.speed * 2.236936)
          : undefined,
    };

    if (prev) {
      const distM = haversineMeters(prev, point);
      const computed = speedMphBetween(prev, point);
      const instant =
        point.rawSpeedMph != null && point.rawSpeedMph > 0.5 ? point.rawSpeedMph : computed;
      smoothedSpeed =
        smoothedSpeed <= 0
          ? instant
          : SPEED_EMA_ALPHA * instant + (1 - SPEED_EMA_ALPHA) * smoothedSpeed;

      const dtSec = Math.max(0, (point.ts - (lastTs || prev.ts)) / 1000);
      lastTs = point.ts;

      if (trackingMiles && distM >= MIN_MOVE_M) {
        // Soft accuracy gate — ignore huge jumps (tunnel/glitch)
        if (!(point.accuracy > 80 && distM > 80)) {
          miles += metersToMiles(distM);
        }
      }

      handlers.onSpeedSample?.({
        speedMph: smoothedSpeed,
        dtSec: dtSec || 1,
        lat: point.lat,
        lng: point.lng,
      });
    } else {
      lastTs = point.ts;
      if (point.rawSpeedMph != null) smoothedSpeed = point.rawSpeedMph;
    }

    emitTelemetry(point);
    prev = point;
  }

  function handleError(err) {
    gpsLost = true;
    handlers.onGpsLost?.(err);
    handlers.onTelemetry?.({
      gpsAvailable: false,
      miles: Math.round(miles * 100) / 100,
      speedMph: Math.round(smoothedSpeed * 10) / 10,
      ts: Date.now(),
    });
  }

  return {
    start() {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        handleError(new Error("Geolocation unavailable"));
        return;
      }
      if (watchId != null) return;
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: cfg.enableHighAccuracy,
        maximumAge: cfg.maximumAge,
        timeout: cfg.timeout,
      });
    },
    stop() {
      if (watchId != null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = null;
    },
    setMilesTracking(on) {
      trackingMiles = Boolean(on);
    },
    seedMiles(n) {
      miles = Math.max(miles, Number(n) || 0);
    },
    getMiles() {
      return Math.round(miles * 100) / 100;
    },
    getSpeedMph() {
      return Math.round(smoothedSpeed * 10) / 10;
    },
  };
}
