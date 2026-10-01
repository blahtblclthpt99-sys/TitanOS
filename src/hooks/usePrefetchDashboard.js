import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { entityQueryKey, fetchEntity, ENTITY_STALE_TIME } from "@/lib/entity-query";
import { scheduleIdleWork } from "@/lib/idleWork";

import { DASHBOARD_QUERIES } from "@/lib/dashboard-queries";

export function usePrefetchDashboard(enabled) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    // Dashboard warming is opportunistic. The visible route should paint and
    // begin its own data work before these background prefetches start.
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
      { delay: 350, timeout: 2000 }
    );
  }, [enabled, queryClient]);
}
