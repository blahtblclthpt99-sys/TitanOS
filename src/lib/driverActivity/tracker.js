/**
 * Browser GPS activity tracker — foreground only during an active work session.
 * Minimizes battery: moderate update cadence, distance filter, no background collection.
 */

import { haversineMeters, metersToMiles, speedMphBetween } from "./geo.js";
import { DEFAULT_STOP_CONFIG, stepStopDetection } from "./stopDetection.js";

const MAX_POINTS = 400;
const MIN_MOVE_M = 12;
const HEARTBEAT_MS = 1000;
const MAX_ACCOUNTING_GAP_SEC = 24 * 60 * 60;

const preciseMiles = (value) => Math.round((Number(value) || 0) * 1000) / 1000;

export function createBrowserTracker(handlers = {}, options = {}) {
  const cfg = {
    ...DEFAULT_STOP_CONFIG,
    enableHighAccuracy: true,
    // Allow slightly stale fixes to cut GNSS wakeups while driving still feels live
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
  let heartbeatId = null;
  let lastAccountingAt = null;
  let motionState = "unknown";
  let latestTelemetry = { lat: null, lng: null, accuracy: null, speedMph: 0 };

  function emit(type, payload) {
    handlers.onEvent?.(type, payload);
  }

  function snapshot() {
    return {
      miles: preciseMiles(miles),
      driveSec: Math.round(driveSec),
      idleSec: Math.round(idleSec),
      maxSpeedMph: maxSpeed,
      avgSpeedMph: speedN ? Math.round((speedSum / speedN) * 10) / 10 : 0,
      speedMph: latestTelemetry.speedMph,
      lat: latestTelemetry.lat,
      lng: latestTelemetry.lng,
      accuracy: latestTelemetry.accuracy,
      stopPhase: stopState.phase,
      points: [...points],
      paused,
    };
  }

  function accountUntil(now = Date.now()) {
    if (paused) {
      lastAccountingAt = now;
      return;
    }
    if (lastAccountingAt == null) {
      lastAccountingAt = now;
      return;
    }
    const dt = Math.min(MAX_ACCOUNTING_GAP_SEC, Math.max(0, (now - lastAccountingAt) / 1000));
    lastAccountingAt = now;
    if (motionState === "driving") driveSec += dt;
    if (motionState === "idle") idleSec += dt;
  }

  function emitTelemetry() {
    handlers.onTelemetry?.(snapshot());
  }

  function startHeartbeat() {
    if (heartbeatId != null || typeof window === "undefined") return;
    heartbeatId = window.setInterval(() => {
      accountUntil(Date.now());
      emitTelemetry();
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatId != null && typeof window !== "undefined") window.clearInterval(heartbeatId);
    heartbeatId = null;
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

    accountUntil(Date.now());
    if (prev) {
      const distM = haversineMeters(prev, point);
      const speed = point.speedMph ?? speedMphBetween(prev, point);

      if (distM >= MIN_MOVE_M) {
        miles += metersToMiles(distM);
        handlers.onMiles?.(preciseMiles(miles));
      }

      if (speed >= cfg.resumeSpeedMph && distM >= MIN_MOVE_M) {
        motionState = "driving";
      } else if (speed < cfg.stopSpeedMph) {
        motionState = "idle";
      } else {
        motionState = "driving";
      }

      if (speed > maxSpeed) maxSpeed = Math.round(speed * 10) / 10;
      if (speed > 0.5) {
        speedSum += speed;
        speedN += 1;
      }

      latestTelemetry = { lat: point.lat, lng: point.lng, accuracy: point.accuracy, speedMph: Math.round(speed * 10) / 10 };
      emitTelemetry();
    } else {
      latestTelemetry = { lat: point.lat, lng: point.lng, accuracy: point.accuracy, speedMph: point.speedMph || 0 };
      motionState = point.speedMph != null && point.speedMph >= cfg.resumeSpeedMph ? "driving" : "idle";
      emitTelemetry();
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
      lastAccountingAt = Date.now();
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: cfg.enableHighAccuracy,
        maximumAge: cfg.maximumAge,
        timeout: cfg.timeout,
      });
      emit("tracking_started", {});
      startHeartbeat();
      return true;
    },
    pause() {
      accountUntil(Date.now());
      paused = true;
      emit("tracking_paused", {});
    },
    resume() {
      paused = false;
      lastAccountingAt = Date.now();
      emit("tracking_resumed", {});
    },
    /** Stop GNSS hardware (keeps counters). Use when tab is hidden to save battery. */
    suspendHardware() {
      if (watchId != null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = null;
      emit("tracking_hardware_suspended", {});
    },
    /** Restart GNSS after suspendHardware. */
    resumeHardware() {
      if (watchId != null) return true;
      if (typeof navigator === "undefined" || !navigator.geolocation) return false;
      accountUntil(Date.now());
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: cfg.enableHighAccuracy,
        maximumAge: cfg.maximumAge,
        timeout: cfg.timeout,
      });
      emit("tracking_hardware_resumed", {});
      return true;
    },
    stop() {
      accountUntil(Date.now());
      if (watchId != null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = null;
      stopHeartbeat();
      paused = false;
      emit("tracking_stopped", snapshot());
    },
    getSnapshot() {
      accountUntil(Date.now());
      return snapshot();
    },
    seedMiles(n) {
      miles = Math.max(0, Number(n) || 0);
    },
    /**
     * Restore counters after page refresh so GPS continues from last saved totals.
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
      if (seedMi != null) miles = Math.max(0, Number(seedMi) || 0);
      if (seedDrive != null) driveSec = Math.max(0, Number(seedDrive) || 0);
      if (seedIdle != null) idleSec = Math.max(0, Number(seedIdle) || 0);
      if (seedMax != null) maxSpeed = Math.max(0, Number(seedMax) || 0);
      lastAccountingAt = Date.now();
      if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        prev = {
          lat: Number(lat),
          lng: Number(lng),
          ts: Date.now(),
          accuracy: null,
        };
      }
      if (openStopId || stopPhase === "stopped" || stopPhase === "potential") {
        motionState = "idle";
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
