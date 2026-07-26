/**
 * Single GPS owner — DoorDash delivery wins over Hub session watch.
 * Prevents dual high-accuracy watchPosition (battery + conflict).
 */
import { readActiveDelivery } from "@/lib/driverActivity/doorDashWorkflow.js";

export const GPS_OWNER_EVENT = "titanos-gps-owner";

/** @returns {"doordash" | "session" | null} */
export function activeGpsOwner(userId) {
  if (!userId) return null;
  try {
    const delivery = readActiveDelivery(userId);
    if (delivery?.status === "active") return "doordash";
  } catch {
    /* ignore */
  }
  return "session";
}

export function isDoorDashGpsActive(userId) {
  return activeGpsOwner(userId) === "doordash";
}

/** Notify Hub session tracker to yield / reclaim GNSS. */
export function notifyGpsOwnerChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GPS_OWNER_EVENT, { detail }));
}
