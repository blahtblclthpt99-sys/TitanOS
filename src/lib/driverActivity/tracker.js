/**
 * Browser GPS activity tracker — foreground only during an active work session.
 * Career-core builds default to approximate/minimum-scope location. Precision may
 * only be enabled by a separately reviewed distribution that has a valid core-use
 * justification and matching user disclosure.
 */

import { haversineMeters, metersToMiles, round1, speedMphBetween } from "./geo.js";
import { DEFAULT_STOP_CONFIG, stepStopDetection } from "./stopDetection.js";

const MAX_POINTS = 400;
const MIN_MOVE_M = 12;

export function createBrowserTracker(handlers = {}, options = {}) {
  const cfg = {
    ...DEFAULT_STOP_CONFIG,
    enableHighAccuracy: false,
    maximumAge: 5000,
    timeout: 15000,
    ...options,
  };

  let watchId = null;
  let prev = null;
  let stopState = { phase: "moving", stationarySec: 0, origin: null, openStopId: null };
  let miles = 0;
  let driveSec = 0;
  let idleSec = 0;
  let maxSpeed = 0;
  let speedSum = 0;
  let speedN = 0;
  let points = [];
  let paused = false;

  function emit(type, payload) {
    handlers.onEvent?.(type, payload);
  }

  function handlePosition(pos) {
    if (paused) return;
    const coords = pos?.coords;
    if (!coords) return;
    const point = {
      lat: coords.latitude,
      lng: coords.longitude,
      ts: pos.timestamp || Date.now(),
      accuracy: coords.accuracy,
      speedMph:
        coords.speed != null && Number.isFinite(coords.speed)
          ? Math.max(0, coords.speed * 2.236936)
          : undefined,
    };

    if (prev) {
      const distM = haversineMeters(prev, point);
      const dt = Math.max(0, (point.ts - prev.ts) / 1000);
      const speed = point.speedMph ?? speedMphBetween(prev, point);

      if (distM >= MIN_MOVE_M) {
        miles = round1(miles + metersToMiles(distM));
        handlers.onMiles?.(miles);
      }

      if (speed >= cfg.resumeSpeedMph && distM >= MIN_MOVE_M) {
        driveSec += dt;
      } else if (speed < cfg.stopSpeedMph) {
        idleSec += dt;
      } else {
        driveSec += dt;
      }

      if (speed > maxSpeed) maxSpeed = Math.round(speed * 10) / 10;
      if (speed > 0.5) {
        speedSum += speed;
        speedN += 1;
      }

      handlers.onTelemetry?.({
        miles,
        driveSec: Math.round(driveSec),
        idleSec: Math.round(idleSec),
        maxSpeedMph: maxSpeed,
        avgSpeedMph: speedN ? Math.round((speedSum / speedN) * 10) / 10 : 0,
        speedMph: Math.round(speed * 10) / 10,
        lat: point.lat,
        lng: point.lng,
        accuracy: point.accuracy,
      });
    }

    const { state, events } = stepStopDetection(stopState, point, prev, cfg);
    stopState = state;
    for (const ev of events) {
      emit(ev.type, ev);
      if (ev.type === "stop_start") handlers.onStopStart?.(ev);
      if (ev.type === "stop_end") handlers.onStopEnd?.(ev);
      if (ev.type === "potential_stop") handlers.onPotentialStop?.(ev);
    }

    points.push({ lat: point.lat, lng: point.lng, ts: point.ts });
    if (points.length > MAX_POINTS) points = points.slice(-MAX_POINTS);
    prev = point;
  }

  function handleError(err) {
    handlers.onError?.(err);
  }

  return {
    start() {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        handleError(Object.assign(new Error("Geolocation unavailable"), { code: "unavailable" }));
        return false;
      }
      if (watchId != null) return true;
      paused = false;
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: cfg.enableHighAccuracy,
        maximumAge: cfg.maximumAge,
        timeout: cfg.timeout,
      });
      emit("tracking_started", {});
      return true;
    },
    pause() {
      paused = true;
      emit("tracking_paused", {});
    },
    resume() {
      paused = false;
      emit("tracking_resumed", {});
    },
    /** Stop location hardware access (keeps counters). Use when tab is hidden to save battery. */
    suspendHardware() {
      if (watchId != null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = null;
      emit("tracking_hardware_suspended", {});
    },
    /** Restart location access after suspendHardware. */
    resumeHardware() {
      if (watchId != null) return true;
      if (typeof navigator === "undefined" || !navigator.geolocation) return false;
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: cfg.enableHighAccuracy,
        maximumAge: cfg.maximumAge,
        timeout: cfg.timeout,
      });
      emit("tracking_hardware_resumed", {});
      return true;
    },
    stop() {
      if (watchId != null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = null;
      paused = false;
      emit("tracking_stopped", {
        miles,
        driveSec: Math.round(driveSec),
        idleSec: Math.round(idleSec),
        maxSpeedMph: maxSpeed,
        avgSpeedMph: speedN ? Math.round((speedSum / speedN) * 10) / 10 : 0,
        points: [...points],
      });
    },
    getSnapshot() {
      return {
        miles,
        driveSec: Math.round(driveSec),
        idleSec: Math.round(idleSec),
        maxSpeedMph: maxSpeed,
        avgSpeedMph: speedN ? Math.round((speedSum / speedN) * 10) / 10 : 0,
        stopPhase: stopState.phase,
        points: [...points],
        paused,
      };
    },
    seedMiles(n) {
      miles = round1(Math.max(0, Number(n) || 0));
    },
    /**
     * Restore counters after page refresh so location tracking continues from last saved totals.
     */
    seedTelemetry({
      miles: seedMi,
      driveSec: seedDrive,
      idleSec: seedIdle,
      maxSpeedMph: seedMax,
      lat,
      lng,
      openStopId,
      stopPhase,
    } = {}) {
      if (seedMi != null) miles = round1(Math.max(0, Number(seedMi) || 0));
      if (seedDrive != null) driveSec = Math.max(0, Number(seedDrive) || 0);
      if (seedIdle != null) idleSec = Math.max(0, Number(seedIdle) || 0);
      if (seedMax != null) maxSpeed = Math.max(0, Number(seedMax) || 0);
      if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        prev = {
          lat: Number(lat),
          lng: Number(lng),
          ts: Date.now(),
          accuracy: null,
        };
      }
      if (openStopId || stopPhase === "stopped" || stopPhase === "potential") {
        stopState = {
          phase: stopPhase === "potential" ? "potential" : "stopped",
          stationarySec: stopPhase === "potential" ? Math.max(1, cfg.confirmStopSec * 0.5) : cfg.confirmStopSec + 1,
          origin: prev ? { lat: prev.lat, lng: prev.lng } : null,
          openStopId: openStopId || stopState.openStopId,
        };
      }
    },
  };
}
