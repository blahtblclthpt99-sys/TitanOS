import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/lib/AuthContext";
import { runWhenIdle } from "@/lib/perf";

const SESSION_MARKER_PREFIX = "titanos:play-entitlement-synced";
const STARTUP_DELAY_MS = 10_000;

function markerKey(userId) {
  return `${SESSION_MARKER_PREFIX}:${userId}`;
}

function alreadySynced(userId) {
  if (!userId || typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(markerKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markSynced(userId) {
  if (!userId || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(markerKey(userId), "1");
  } catch {
    /* storage may be unavailable; a later session can safely verify again */
  }
}

/**
 * Deferred Android-only Google Play entitlement reconciliation.
 * Keeps billing off the critical startup path while recovering subscriptions
 * after reinstall, app-data restoration, or a device change.
 */
export default function PlayEntitlementSync() {
  const { user, checkUserAuth } = useAuth();
  const userId = user?.id || null;

  useEffect(() => {
    if (!userId || alreadySynced(userId)) return undefined;

    const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
    if (!isAndroid) {
      markSynced(userId);
      return undefined;
    }

    let cancelled = false;
    let cancelIdle = () => {};

    const reconcile = async () => {
      if (cancelled || document.visibilityState === "hidden" || alreadySynced(userId)) return;

      try {
        const billing = await import("@/lib/playBilling");
        if (cancelled) return;

        const purchases = await billing.restorePlaySubscriptions();
        if (cancelled) return;

        const purchased = (purchases || []).filter((purchase) => purchase?.purchaseState === 1);
        if (!purchased.length) {
          markSynced(userId);
          return;
        }

        let verified = 0;
        for (const purchase of purchased) {
          if (cancelled) return;
          try {
            await billing.verifyPlayPurchase(purchase);
            verified += 1;
          } catch {
            // A stale purchase should not block another valid entitlement.
          }
        }

        if (!verified || cancelled) return;
        await checkUserAuth();
        if (!cancelled) markSynced(userId);
      } catch {
        // Offline / Play unavailable: keep the marker unset so a future app
        // session can retry without falsely declaring recovery complete.
      }
    };

    const timer = window.setTimeout(() => {
      cancelIdle = runWhenIdle(() => {
        void reconcile();
      }, 5000);
    }, STARTUP_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelIdle?.();
    };
  }, [userId, checkUserAuth]);

  return null;
}
