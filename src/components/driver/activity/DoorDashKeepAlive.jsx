/**
 * Keeps DoorDash delivery GPS + auto-depart running across Hub tabs / routes
 * while a delivery is active. Throttles persistence, wake-locks the screen,
 * and flushes on pagehide for contender-grade reliability.
 */

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createDoorDashTracker } from "@/lib/driverActivity/doorDashTracker.js";
import {
  applyMiles,
  DD_EVENT,
  DD_SCREENS,
  readActiveDelivery,
  rememberGps,
  saveDeliverySnapshot,
  setGpsAvailable,
  tickRestaurantSpeed,
} from "@/lib/driverActivity/doorDashWorkflow.js";

export { DD_EVENT };

const MILES_PERSIST_MS = 2000;
const MILES_DELTA = 0.05;

export default function DoorDashKeepAlive() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const trackerRef = useRef(null);
  const deliveryRef = useRef(null);
  const wakeRef = useRef(null);
  const lastPersistAt = useRef(0);
  const lastPersistedMiles = useRef(0);

  const releaseWake = useCallback(async () => {
    try {
      await wakeRef.current?.release?.();
    } catch {
      /* ignore */
    }
    wakeRef.current = null;
  }, []);

  const requestWake = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.wakeLock?.request) return;
    try {
      wakeRef.current = await navigator.wakeLock.request("screen");
      wakeRef.current.addEventListener?.("release", () => {
        wakeRef.current = null;
      });
    } catch {
      /* unsupported / denied */
    }
  }, []);

  const persist = useCallback(
    (next, opts = {}) => {
      if (!userId) return;
      saveDeliverySnapshot(userId, next, opts);
      if (!next || next.status !== "active") {
        deliveryRef.current = null;
        trackerRef.current?.stop();
        trackerRef.current = null;
        lastPersistAt.current = 0;
        lastPersistedMiles.current = 0;
        releaseWake();
      } else {
        deliveryRef.current = next;
        trackerRef.current?.setMilesTracking(Boolean(next.milesTracking));
        trackerRef.current?.seedMiles(next.miles || 0);
        lastPersistedMiles.current = Number(next.miles || 0);
        lastPersistAt.current = Date.now();
      }
    },
    [userId, releaseWake]
  );

  const ensureTracker = useCallback(() => {
    if (!userId) return;
    const active = readActiveDelivery(userId);
    deliveryRef.current = active;
    if (!active || active.status !== "active") {
      trackerRef.current?.stop();
      trackerRef.current = null;
      releaseWake();
      return;
    }

    requestWake();

    if (trackerRef.current) {
      trackerRef.current.setMilesTracking(Boolean(active.milesTracking));
      trackerRef.current.seedMiles(active.miles || 0);
      return;
    }

    const tracker = createDoorDashTracker({
      onTelemetry: (t) => {
        const cur = deliveryRef.current || readActiveDelivery(userId);
        if (!cur || cur.status !== "active") return;

        if (t.lat != null && t.lng != null) {
          rememberGps({ lat: t.lat, lng: t.lng, accuracy: t.accuracy });
        }

        let next = cur;
        if (t.gpsAvailable === false) {
          next = setGpsAvailable(next, false);
        } else if (cur.gpsAvailable === false) {
          next = setGpsAvailable(next, true);
        }
        if (t.miles != null) {
          next = applyMiles(next, t.miles);
        }

        const milesChanged = Number(next.miles || 0) !== Number(cur.miles || 0);
        const gpsFlagChanged = next.gpsAvailable !== cur.gpsAvailable;
        if (!milesChanged && !gpsFlagChanged) return;

        const now = Date.now();
        const milesDelta = Math.abs(Number(next.miles || 0) - lastPersistedMiles.current);
        const due =
          gpsFlagChanged ||
          milesDelta >= MILES_DELTA ||
          now - lastPersistAt.current >= MILES_PERSIST_MS;

        deliveryRef.current = next;
        if (due) {
          persist(next, { soft: true });
        }
      },
      onSpeedSample: ({ speedMph, dtSec, lat, lng }) => {
        const cur = deliveryRef.current || readActiveDelivery(userId);
        if (!cur || cur.status !== "active") return;
        if (cur.screen !== DD_SCREENS.AT_RESTAURANT) return;
        rememberGps({ lat, lng });
        const { delivery: next, departed } = tickRestaurantSpeed(cur, speedMph, dtSec, {
          gps: { lat, lng },
        });
        if (departed) {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([40, 40, 80]);
            } catch {
              /* ignore */
            }
          }
          persist(next, { soft: false, departed: true });
          return;
        }
        if (next !== cur) {
          deliveryRef.current = next;
          // streak updates — soft persist occasionally
          if (Number(next.highSpeedStreakSec || 0) !== Number(cur.highSpeedStreakSec || 0)) {
            persist(next, { soft: true });
          }
        }
      },
      onGpsLost: () => {
        const cur = deliveryRef.current || readActiveDelivery(userId);
        if (!cur) return;
        persist(setGpsAvailable(cur, false), { soft: true });
      },
      onGpsRestored: () => {
        const cur = deliveryRef.current || readActiveDelivery(userId);
        if (!cur) return;
        persist(setGpsAvailable(cur, true), { soft: true });
      },
    });
    tracker.seedMiles(active.miles || 0);
    tracker.setMilesTracking(Boolean(active.milesTracking));
    tracker.start();
    trackerRef.current = tracker;
    lastPersistedMiles.current = Number(active.miles || 0);
  }, [userId, persist, releaseWake, requestWake]);

  useEffect(() => {
    if (!userId) {
      trackerRef.current?.stop();
      trackerRef.current = null;
      deliveryRef.current = null;
      releaseWake();
      return undefined;
    }
    ensureTracker();
    const onChange = (e) => {
      if (e?.detail?.soft) {
        deliveryRef.current = readActiveDelivery(userId);
        return;
      }
      ensureTracker();
    };
    window.addEventListener(DD_EVENT, onChange);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        ensureTracker();
        if (deliveryRef.current?.status === "active") requestWake();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const onHide = () => {
      const cur = deliveryRef.current || readActiveDelivery(userId);
      if (cur?.status === "active") {
        saveDeliverySnapshot(userId, cur, { silent: true });
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener(DD_EVENT, onChange);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      onHide();
      trackerRef.current?.stop();
      trackerRef.current = null;
      releaseWake();
    };
  }, [userId, ensureTracker, releaseWake, requestWake]);

  return null;
}
