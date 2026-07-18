import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { entityQueryKey, fetchEntity, ENTITY_STALE_TIME } from "@/lib/entity-query";

import { DASHBOARD_QUERIES } from "@/lib/dashboard-queries";

export function usePrefetchDashboard(enabled) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    DASHBOARD_QUERIES.forEach((descriptor) => {
      queryClient.prefetchQuery({
        queryKey: entityQueryKey(descriptor),
        queryFn: () => fetchEntity(descriptor),
        staleTime: ENTITY_STALE_TIME,
      });
    });
  }, [enabled, queryClient]);
}
