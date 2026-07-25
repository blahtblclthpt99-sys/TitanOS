import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ensureNotificationCenter, unreadCount } from "@/lib/notificationsApi";

export const UNREAD_NOTIFICATIONS_KEY = ["notifications", "unread-count"];

const POLL_MS = 45_000;

/**
 * Single shared unread badge source for shell chrome (bell + desktop center).
 * Visibility-aware: pauses while the tab is hidden to cut idle PostgREST load.
 */
export function useUnreadNotificationCount(userId) {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden"
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onVis = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const query = useQuery({
    queryKey: [...UNREAD_NOTIFICATIONS_KEY, userId || "anon"],
    enabled: Boolean(userId),
    queryFn: async () => {
      await ensureNotificationCenter(userId);
      return unreadCount(userId);
    },
    staleTime: 30_000,
    refetchInterval: visible ? POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [...UNREAD_NOTIFICATIONS_KEY, userId || "anon"] });

  return {
    count: typeof query.data === "number" ? query.data : 0,
    isLoading: query.isLoading,
    invalidate,
    setCount: (next) => {
      queryClient.setQueryData([...UNREAD_NOTIFICATIONS_KEY, userId || "anon"], next);
    },
  };
}
