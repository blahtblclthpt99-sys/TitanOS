import React, { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import AppLayout from "@/components/layout/AppLayout";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import DriverSessionKeepAlive from "@/components/driver/activity/DriverSessionKeepAlive";
import CareerAttentionSync from "@/components/career/CareerAttentionSync";
import { useAuth } from "@/lib/AuthContext";
import { warmSearchIndex } from "@/lib/searchIndex";
import { trackEvent } from "@/lib/productAnalytics";
import { refreshFeatureFlagsFromServer } from "@/lib/featureFlags";
import ScheduledExportRunner from "@/components/shared/ScheduledExportRunner";

function PrefetchOnMount() {
  usePrefetchDashboard(true);
  const { user } = useAuth();
  useEffect(() => {
    if (user?.id) {
      warmSearchIndex(user.id).catch(() => {});
      trackEvent("session_start");
      refreshFeatureFlagsFromServer().catch(() => {});
    }
  }, [user?.id]);
  return null;
}

/**
 * Authenticated TitanOS shell.
 *
 * Career and opportunity workflows are the product core. CareerAttentionSync
 * only creates deduplicated in-app reminders; it never applies, messages an
 * employer, or changes application state. Specialized driver activity support
 * remains available for users who enter Driver Hub, while retired DoorDash-
 * specific global logic stays excluded.
 */
export default function AuthenticatedShell() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <PrefetchOnMount />
      <CareerAttentionSync />
      <ScheduledExportRunner />
      <DriverSessionKeepAlive />
      <AppLayout />
    </QueryClientProvider>
  );
}
