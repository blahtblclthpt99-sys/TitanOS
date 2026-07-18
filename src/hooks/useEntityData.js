/**
 * useEntityData — generic data-fetching hook backed by TanStack Query.
 * Accepts an array of { entity, method, args } descriptors and returns
 * { data: [...results], loading, error, reload }.
 */
import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { entityQueryKey, fetchEntity, ENTITY_STALE_TIME } from "@/lib/entity-query";

export function useEntityData(descriptors, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const stableDescriptors = useMemo(
    () => descriptors,
    [JSON.stringify(descriptors)]
  );

  const queries = useQueries({
    queries: stableDescriptors.map((descriptor) => ({
      queryKey: entityQueryKey(descriptor),
      queryFn: () => fetchEntity(descriptor),
      enabled,
      staleTime: ENTITY_STALE_TIME,
    })),
  });

  const loading = enabled && queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.error)?.error ?? null;
  const data = queries.map((query) => query.data ?? []);

  const reload = async () => {
    await Promise.all(
      stableDescriptors.map((descriptor) =>
        queryClient.invalidateQueries({ queryKey: entityQueryKey(descriptor) })
      )
    );
  };

  return { data, loading, error, reload };
}
