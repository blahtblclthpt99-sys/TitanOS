import { QueryClient } from '@tanstack/react-query';
import { ENTITY_STALE_TIME } from '@/lib/entity-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: ENTITY_STALE_TIME,
    },
  },
});
