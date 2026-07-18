import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entityQueryKey, fetchEntity, ENTITY_STALE_TIME } from "@/lib/entity-query";

/**
 * Fetch a single entity record by ID with TanStack Query caching.
 */
export function useEntityRecord(entity, id, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const descriptor = { entity, method: "get", args: [id] };

  const query = useQuery({
    queryKey: entityQueryKey(descriptor),
    queryFn: () => fetchEntity(descriptor),
    enabled: enabled && Boolean(id),
    staleTime: ENTITY_STALE_TIME,
  });

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: entityQueryKey(descriptor) });
  };

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ?? null,
    reload,
  };
}
