import { QueryClient } from "@tanstack/react-query";
import { ENTITY_STALE_TIME } from "@/lib/entity-query";

/** Keep entity data warm across tab switches without hammering the API */
const ENTITY_GC_TIME = 10 * 60_000;

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Manual staggered reconnect below — avoids thundering herd on network flaps
      refetchOnReconnect: false,
      retry: 1,
      staleTime: ENTITY_STALE_TIME,
      gcTime: ENTITY_GC_TIME,
      structuralSharing: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Stagger reconnect refetches so 10k tabs don't hit PostgREST in the same second. */
if (typeof window !== "undefined") {
  let reconnectTimer = null;
  window.addEventListener("online", () => {
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    const delay = 400 + Math.floor(Math.random() * 2600);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      void queryClientInstance.refetchQueries({ type: "active", stale: true });
    }, delay);
  });
}
