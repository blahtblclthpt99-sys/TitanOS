/**
 * Keeps Driver Hub GPS + drive/idle timers alive across Hub tabs,
 * other app pages, and soft navigations — while a work session is active.
 * Pair with seedTelemetry + never-decrease patches so refresh does not reset counters.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useDriverActivityTracker } from "@/components/driver/activity/useDriverActivityTracker";
import { readPrefs, readSession } from "@/lib/driverHubApi";

export const DRIVER_SESSION_EVENT = "titanos-driver-session";

export default function DriverSessionKeepAlive() {
  const { user } = useAuth();
  const [session, setSession] = useState(() => (user?.id ? readSession(user.id) : null));
  const [prefs, setPrefs] = useState(() => (user?.id ? readPrefs(user.id) : {}));

  const refresh = useCallback(() => {
    if (!user?.id) {
      setSession(null);
      setPrefs({});
      return;
    }
    setSession(readSession(user.id));
    setPrefs(readPrefs(user.id));
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const onChange = () => refresh();
    window.addEventListener(DRIVER_SESSION_EVENT, onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("focus", onChange);
    const id = window.setInterval(onChange, 2500);
    return () => {
      window.removeEventListener(DRIVER_SESSION_EVENT, onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onChange);
      window.clearInterval(id);
    };
  }, [user?.id, refresh]);

  const active = Boolean(session?.active);
  const paused = Boolean(session?.paused);

  useDriverActivityTracker({
    userId: user?.id,
    active,
    paused,
    autoTrack: prefs.autoTrack !== false,
    stopConfirmSec: Number(prefs.stopConfirmSec) || 90,
    enabled: Boolean(prefs.locationPrivacyAck),
    onUpdate: (nextSession, _stops, err) => {
      if (err) return;
      if (nextSession) setSession(nextSession);
      else refresh();
    },
  });

  return null;
}
