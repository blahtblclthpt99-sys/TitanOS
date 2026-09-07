import { useEffect } from "react";
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
    /* storage may be unavailable; next launch can safely verify again */
  }
}

/**
 * Deferred Android-only entitlement recovery.
 *
 * Google Play keeps ownership state outside TitanOS. Querying owned
 * subscriptions after launch lets an existing subscriber recover access after
 * reinstall, cache clear, or app-data restoration without making Pricing the
 * only recovery path. Billing code is loaded only after confirming Android.
 */
export default function PlayEntitlementSync() {
  const { user, checkUserAuth } = useAuth();
  const userId = user?.id || null;

  useEffect(() => {
    if (!userId || alreadySynced(userId)) return undefined;

    let cancelled = false;
    let cancelIdle = () => {};

    const run = async () => {
      if (cancelled || document.visibilityState === "hidden" || alreadySynced(userId)) return;

      try {
        const { Capacitor } = await import("@capacitor/core");
        const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
        if (cancelled) return;
        if (!isAndroid) {
          markSynced(userId);
          return;
        }

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
            // Leave the marker unset if no entitlement can be verified so a
            // later app session can safely retry after network/Play recovery.
          }
        }

        if (!verified || cancelled) return;
        await checkUserAuth();
        if (!cancelled) markSynced(userId);
      } catch {
        // Offline, Play Services unavailable, or billing not ready: keep the
        // marker unset so recovery is retried on a future app session.
      }
    };

    const timer = window.setTimeout(() => {
      cancelIdle = runWhenIdle(() => {
        void run();
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
