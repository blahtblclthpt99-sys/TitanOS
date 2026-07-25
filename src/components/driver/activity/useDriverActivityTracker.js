import { useEffect, useRef } from "react";
import { createBrowserTracker } from "@/lib/driverActivity";
import {
  addStop,
  endStop,
  patchSessionTelemetry,
  readStops,
} from "@/lib/driverHubApi";

/**
 * Foreground GPS tracker bound to an active Driver Hub work session.
 * Stops automatically when the session ends or autoTrack is off.
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

    trackerRef.current = tracker;
    tracker.start();

    return () => {
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
