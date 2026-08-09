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
import { readPrefs, readSession } from "@/lib/driverHubApi";
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

  return null;
}
