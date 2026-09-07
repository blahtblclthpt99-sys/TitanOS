import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { entityQueryKey, fetchEntity, ENTITY_STALE_TIME } from "@/lib/entity-query";
import { scheduleIdleWork } from "@/lib/idleWork";

import { DASHBOARD_QUERIES } from "@/lib/dashboard-queries";

export function usePrefetchDashboard(enabled) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    // Dashboard warming is useful, but it must not compete with the route the
    // user actually opened. Give the active page first claim on CPU/network.
    return scheduleIdleWork(
      () => {
        DASHBOARD_QUERIES.forEach((descriptor) => {
          queryClient.prefetchQuery({
            queryKey: entityQueryKey(descriptor),
            queryFn: () => fetchEntity(descriptor),
            staleTime: ENTITY_STALE_TIME,
          });
        });
      },
      { delay: 500, timeout: 2500 }
    );
  }, [enabled, queryClient]);
}
