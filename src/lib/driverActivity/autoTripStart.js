/**
 * Opt-in motion watcher — starts a driving session after sustained movement
 * while off-shift. Never runs without prefs.autoStartOnMotion + privacy ack.
 */
import { startDrivingSession, readPrefs, readSession } from "@/lib/driverHubApi";
import { isDoorDashGpsActive } from "@/lib/driverActivity/gpsOwner.js";
import { toast } from "@/components/ui/use-toast";

const HOLD_MS = 45_000;
const SPEED_MPH = 8;

/**
 * @returns {() => void} cleanup
 */
export function startAutoTripWatcher(user, { onStarted } = {}) {
  if (!user?.id) return () => {};
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};

  let watchId = null;
  let movingSince = null;
  let starting = false;

  const stop = () => {
    if (watchId != null) {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* ignore */
      }
      watchId = null;
    }
    movingSince = null;
  };

  const tick = async (pos) => {
    if (starting) return;
    const prefs = readPrefs(user.id);
    if (!prefs.autoStartOnMotion || !prefs.locationPrivacyAck || prefs.autoTrack === false) {
      stop();
      return;
    }
    if (readSession(user.id)?.active) {
      stop();
      return;
    }
    if (isDoorDashGpsActive(user.id)) {
      stop();
      return;
    }

    const speedMs = pos?.coords?.speed;
    const mph =
      speedMs != null && Number.isFinite(speedMs) && speedMs >= 0
        ? speedMs * 2.236936
        : null;
    const now = Date.now();
    if (mph != null && mph >= SPEED_MPH) {
      if (!movingSince) movingSince = now;
      if (now - movingSince >= HOLD_MS) {
        starting = true;
        try {
          await startDrivingSession(user, prefs);
          toast({
            title: "Trip auto-started",
            description: "Sustained motion detected — Driving is ON.",
          });
          onStarted?.();
          stop();
        } catch {
          starting = false;
          movingSince = null;
        }
      }
    } else {
      movingSince = null;
    }
  };

  watchId = navigator.geolocation.watchPosition(
    tick,
    () => {
      movingSince = null;
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );

  return stop;
}
