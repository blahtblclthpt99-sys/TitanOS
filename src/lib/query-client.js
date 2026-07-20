import { QueryClient } from "@tanstack/react-query";
import { ENTITY_STALE_TIME } from "@/lib/entity-query";

/** Keep entity data warm across tab switches without hammering the API */
const ENTITY_GC_TIME = 10 * 60_000;

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
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
