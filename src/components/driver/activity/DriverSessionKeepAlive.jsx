/**
 * Keeps Driver Hub GPS + drive/idle timers alive across Hub tabs,
 * other app pages, and soft navigations — while a work session is active.
 * Yields GNSS to DoorDash while a delivery is active (one watch only).
 * Opt-in auto-start watches motion while off-shift.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useDriverActivityTracker } from "@/components/driver/activity/useDriverActivityTracker";
import { useVisibilityInterval } from "@/hooks/useVisibilityInterval";
import { readPrefs, readSession, stopDrivingSession } from "@/lib/driverHubApi";
import { Button } from "@/components/ui/button";
import { DD_EVENT } from "@/lib/driverActivity/doorDashWorkflow.js";
import { GPS_OWNER_EVENT, isDoorDashGpsActive } from "@/lib/driverActivity/gpsOwner.js";
import { startAutoTripWatcher } from "@/lib/driverActivity/autoTripStart.js";
import { DRIVER_SESSION_EVENT } from "@/lib/driverOs";

/** Keep-alive for driver session telemetry while shell is mounted. */

export default function DriverSessionKeepAlive() {
  const { user } = useAuth();
  const [session, setSession] = useState(() => (user?.id ? readSession(user.id) : null));
  const [prefs, setPrefs] = useState(() => (user?.id ? readPrefs(user.id) : {}));
  const [ddOwnsGps, setDdOwnsGps] = useState(() =>
    user?.id ? isDoorDashGpsActive(user.id) : false
  );
  const [idlePrompt, setIdlePrompt] = useState(false);
  const [nextIdlePromptSec, setNextIdlePromptSec] = useState(15 * 60);

  const refresh = useCallback(() => {
    if (!user?.id) {
      setSession(null);
      setPrefs({});
      setDdOwnsGps(false);
      return;
    }
    setSession(readSession(user.id));
    setPrefs(readPrefs(user.id));
    setDdOwnsGps(isDoorDashGpsActive(user.id));
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const onChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      refresh();
    };
    window.addEventListener(DRIVER_SESSION_EVENT, onChange);
    window.addEventListener(DD_EVENT, onChange);
    window.addEventListener(GPS_OWNER_EVENT, onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(DRIVER_SESSION_EVENT, onChange);
      window.removeEventListener(DD_EVENT, onChange);
      window.removeEventListener(GPS_OWNER_EVENT, onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [user?.id, refresh]);

  useVisibilityInterval(refresh, 5000, { enabled: Boolean(user?.id) });

  const active = Boolean(session?.active);
  const paused = Boolean(session?.paused);

  useEffect(() => {
    if (!active) {
      setIdlePrompt(false);
      setNextIdlePromptSec(15 * 60);
      return;
    }
    if (!paused && Number(session?.idle_sec || 0) >= nextIdlePromptSec) {
      setIdlePrompt(true);
    }
  }, [active, paused, session?.idle_sec, nextIdlePromptSec]);

  useEffect(() => {
    if (!idlePrompt || !user?.id) return undefined;
    const autoStop = window.setTimeout(async () => {
      const latest = readSession(user.id);
      await stopDrivingSession(user.id, {
        miles: latest?.miles,
        driveSec: latest?.drive_sec,
        idleSec: latest?.idle_sec,
        maxSpeedMph: latest?.max_speed_mph,
        avgSpeedMph: latest?.avg_speed_mph,
        autoMiles: latest?.auto_miles,
        milesSource: latest?.miles_source,
      });
      setIdlePrompt(false);
      refresh();
    }, 60_000);
    return () => window.clearTimeout(autoStop);
  }, [idlePrompt, user?.id, refresh]);

  useEffect(() => {
    if (!user?.id) return undefined;
    if (active) return undefined;
    if (!prefs.autoStartOnMotion || !prefs.locationPrivacyAck) return undefined;
    if (ddOwnsGps) return undefined;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return undefined;
    return startAutoTripWatcher(user, { onStarted: refresh });
  }, [user, active, prefs.autoStartOnMotion, prefs.locationPrivacyAck, ddOwnsGps, refresh]);

  useDriverActivityTracker({
    userId: user?.id,
    active,
    paused,
    autoTrack: prefs.autoTrack !== false,
    stopConfirmSec: Number(prefs.stopConfirmSec) || 90,
    enabled: Boolean(prefs.locationPrivacyAck) && !ddOwnsGps,
    onUpdate: (nextSession, _stops, err) => {
      if (err) return;
      if (nextSession) setSession(nextSession);
      else refresh();
    },
  });

  if (!idlePrompt) return null;

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="driver-idle-title">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h2 id="driver-idle-title" className="text-xl font-semibold text-foreground">Still driving?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No movement has been detected for 15 minutes. This session will stop automatically in one minute.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px]"
            onClick={async () => {
              await stopDrivingSession(user.id, {
                miles: session?.miles,
                driveSec: session?.drive_sec,
                idleSec: session?.idle_sec,
                autoMiles: session?.auto_miles,
                milesSource: session?.miles_source,
              });
              setIdlePrompt(false);
              refresh();
            }}
          >
            Stop driving
          </Button>
          <Button
            type="button"
            className="min-h-[48px]"
            onClick={() => {
              setNextIdlePromptSec(Number(session?.idle_sec || 0) + 15 * 60);
              setIdlePrompt(false);
            }}
          >
            Yes, continue
          </Button>
        </div>
      </div>
    </div>
  );
}
