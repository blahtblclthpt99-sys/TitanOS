import { useEffect, useRef } from "react";
import { createBrowserTracker } from "@/lib/driverActivity";
import {
  addStop,
  endStop,
  patchSessionTelemetry,
  readSession,
  readStops,
} from "@/lib/driverHubApi";

/**
 * Foreground GPS tracker bound to an active Driver Hub work session.
 * Seeds counters from persisted session so refresh does not reset timers.
 * Flushes snapshot on pagehide / visibility hidden.
 */
export function useDriverActivityTracker({
  userId,
  active,
  paused,
  autoTrack,
  stopConfirmSec = 90,
  enabled = true,
  onUpdate,
}) {
  const trackerRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!userId || !active || !autoTrack || !enabled) {
      trackerRef.current?.stop();
      trackerRef.current = null;
      return undefined;
    }

    const session = readSession(userId);
    const stops = readStops(userId);
    const openStop = [...stops].reverse().find((s) => s && !s.ended_at) || null;

    const tracker = createBrowserTracker(
      {
        onMiles(miles) {
          const next = patchSessionTelemetry(userId, {
            auto_miles: miles,
            miles_source: "gps",
          });
          onUpdateRef.current?.(next, readStops(userId));
        },
        onTelemetry(t) {
          const next = patchSessionTelemetry(userId, {
            auto_miles: t.miles,
            drive_sec: t.driveSec,
            idle_sec: t.idleSec,
            max_speed_mph: t.maxSpeedMph,
            avg_speed_mph: t.avgSpeedMph,
            lat: t.lat,
            lng: t.lng,
          });
          onUpdateRef.current?.(next, readStops(userId));
        },
        onStopStart(ev) {
          // Avoid duplicate open stops after refresh while still parked
          const existing = readStops(userId);
          const alreadyOpen = existing.some((s) => !s.ended_at);
          if (alreadyOpen) {
            const next = patchSessionTelemetry(userId, { stop_phase: "stopped" });
            onUpdateRef.current?.(next, readStops(userId));
            return;
          }
          addStop(userId, {
            id: ev.id,
            started_at: ev.at,
            lat: ev.lat,
            lng: ev.lng,
            auto: true,
            label: "Detected stop",
          });
          const next = patchSessionTelemetry(userId, { stop_phase: "stopped" });
          onUpdateRef.current?.(next, readStops(userId));
        },
        onStopEnd(ev) {
          endStop(userId, ev.id);
          const next = patchSessionTelemetry(userId, { stop_phase: "moving" });
          onUpdateRef.current?.(next, readStops(userId));
        },
        onPotentialStop() {
          const next = patchSessionTelemetry(userId, { stop_phase: "potential" });
          onUpdateRef.current?.(next, readStops(userId));
        },
        onError(err) {
          onUpdateRef.current?.(null, null, err);
        },
      },
      { confirmStopSec: stopConfirmSec }
    );

    tracker.seedTelemetry({
      miles: Number(session?.auto_miles ?? session?.miles ?? 0),
      driveSec: Number(session?.drive_sec || 0),
      idleSec: Number(session?.idle_sec || 0),
      maxSpeedMph: Number(session?.max_speed_mph || 0),
      lat: session?.lat,
      lng: session?.lng,
      openStopId: openStop?.id || null,
      stopPhase: openStop ? "stopped" : session?.stop_phase || "moving",
    });

    trackerRef.current = tracker;
    tracker.start();
    if (paused) tracker.pause();

    const flush = () => {
      const snap = tracker.getSnapshot?.();
      if (!snap) return;
      const next = patchSessionTelemetry(userId, {
        auto_miles: snap.miles,
        drive_sec: snap.driveSec,
        idle_sec: snap.idleSec,
        max_speed_mph: snap.maxSpeedMph,
        avg_speed_mph: snap.avgSpeedMph,
        stop_phase: snap.stopPhase,
      });
      onUpdateRef.current?.(next, readStops(userId));
    };

    const onHide = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      tracker.stop();
      trackerRef.current = null;
    };
  }, [userId, active, autoTrack, enabled, stopConfirmSec]);

  useEffect(() => {
    const t = trackerRef.current;
    if (!t) return;
    if (paused) t.pause();
    else t.resume();
  }, [paused]);

  return trackerRef;
}
