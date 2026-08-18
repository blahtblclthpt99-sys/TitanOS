import React, { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import AppLayout from "@/components/layout/AppLayout";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import { useAuth } from "@/lib/AuthContext";
import { trackEvent } from "@/lib/productAnalytics";
import { refreshFeatureFlagsFromServer } from "@/lib/featureFlags";

function CoreBoot() {
  usePrefetchDashboard(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    trackEvent("session_start");
    refreshFeatureFlagsFromServer().catch(() => {});
  }, [user?.id]);

  return null;
}

/**
 * Authenticated TitanOS core shell.
 * Non-core Driver/DoorDash keepalives, scheduled exports, and global-search warming
 * no longer run for every signed-in session. Their legacy routes remain compatible,
 * but they do not consume startup work unless they are explicitly reintroduced.
 */
export default function AuthenticatedShell() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <CoreBoot />
      <AppLayout />
    </QueryClientProvider>
  );
}
