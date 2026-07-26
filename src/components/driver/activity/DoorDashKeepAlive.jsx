/**
 * Keeps DoorDash delivery GPS + auto-depart running across Hub tabs / routes
 * while a delivery is active and the user is signed in.
 */

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createDoorDashTracker } from "@/lib/driverActivity/doorDashTracker.js";
import {
  applyMiles,
  DD_EVENT,
  DD_SCREENS,
  readActiveDelivery,
  saveDeliverySnapshot,
  setGpsAvailable,
  tickRestaurantSpeed,
} from "@/lib/driverActivity/doorDashWorkflow.js";

export { DD_EVENT };

export default function DoorDashKeepAlive() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const trackerRef = useRef(null);
  const deliveryRef = useRef(null);

  const persist = useCallback(
    (next) => {
      if (!userId) return;
      saveDeliverySnapshot(userId, next);
      if (!next || next.status !== "active") {
        deliveryRef.current = null;
        trackerRef.current?.stop();
        trackerRef.current = null;
      } else {
        deliveryRef.current = next;
        trackerRef.current?.setMilesTracking(Boolean(next.milesTracking));
        trackerRef.current?.seedMiles(next.miles || 0);
      }
    },
    [userId]
  );

  const ensureTracker = useCallback(() => {
    if (!userId) return;
    const active = readActiveDelivery(userId);
    deliveryRef.current = active;
    if (!active || active.status !== "active") {
      trackerRef.current?.stop();
      trackerRef.current = null;
      return;
    }

    if (trackerRef.current) {
      trackerRef.current.setMilesTracking(Boolean(active.milesTracking));
      trackerRef.current.seedMiles(active.miles || 0);
      return;
    }

    const tracker = createDoorDashTracker({
      onTelemetry: (t) => {
        const cur = deliveryRef.current || readActiveDelivery(userId);
        if (!cur || cur.status !== "active") return;
        let next = cur;
        if (t.gpsAvailable === false) {
          next = setGpsAvailable(next, false);
        } else if (cur.gpsAvailable === false) {
          next = setGpsAvailable(next, true);
        }
        if (t.miles != null) {
          next = applyMiles(next, t.miles);
        }
        if (next !== cur) persist(next);
      },
      onSpeedSample: ({ speedMph, dtSec, lat, lng }) => {
        const cur = deliveryRef.current || readActiveDelivery(userId);
        if (!cur || cur.status !== "active") return;
        if (cur.screen !== DD_SCREENS.AT_RESTAURANT) return;
        const { delivery: next, departed } = tickRestaurantSpeed(cur, speedMph, dtSec, {
          gps: { lat, lng },
        });
        if (next !== cur || departed) persist(next);
      },
      onGpsLost: () => {
        const cur = deliveryRef.current || readActiveDelivery(userId);
        if (!cur) return;
        persist(setGpsAvailable(cur, false));
      },
      onGpsRestored: () => {
        const cur = deliveryRef.current || readActiveDelivery(userId);
        if (!cur) return;
        persist(setGpsAvailable(cur, true));
      },
    });
    tracker.seedMiles(active.miles || 0);
    tracker.setMilesTracking(Boolean(active.milesTracking));
    tracker.start();
    trackerRef.current = tracker;
  }, [userId, persist]);

  useEffect(() => {
    if (!userId) {
      trackerRef.current?.stop();
      trackerRef.current = null;
      deliveryRef.current = null;
      return undefined;
    }
    ensureTracker();
    const onChange = () => ensureTracker();
    window.addEventListener(DD_EVENT, onChange);
    const onVis = () => {
      if (document.visibilityState === "visible") ensureTracker();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(DD_EVENT, onChange);
      document.removeEventListener("visibilitychange", onVis);
      trackerRef.current?.stop();
      trackerRef.current = null;
    };
  }, [userId, ensureTracker]);

  return null;
}
