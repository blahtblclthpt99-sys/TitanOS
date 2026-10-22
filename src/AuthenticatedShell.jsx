import React, { useEffect } from "react";
import { useLocation } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import AppLayout from "@/components/layout/AppLayout";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import DriverSessionKeepAlive from "@/components/driver/activity/DriverSessionKeepAlive";
import DoorDashKeepAlive from "@/components/driver/activity/DoorDashKeepAlive";
import { useAuth } from "@/lib/AuthContext";
import { warmSearchIndex } from "@/lib/searchIndex";
import { trackEvent } from "@/lib/productAnalytics";
import { refreshFeatureFlagsFromServer } from "@/lib/featureFlags";
import ScheduledExportRunner from "@/components/shared/ScheduledExportRunner";

function PrefetchOnMount() {
  const { pathname } = useLocation();
  const isDashboard = pathname === "/business-dashboard";
  usePrefetchDashboard(isDashboard);
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

/** Authenticated app shell — keeps react-query out of the marketing bundle. */
function RouteScopedServices() {
  const { pathname } = useLocation();
  const isDriver = pathname === "/driver" || pathname.startsWith("/driver/");
  const isExport = pathname.startsWith("/reports") || pathname.startsWith("/settings");
  return <>
    {isDriver && <DriverSessionKeepAlive />}
    {isDriver && <DoorDashKeepAlive />}
    {isExport && <ScheduledExportRunner />}
  </>;
}

export default function AuthenticatedShell() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <PrefetchOnMount />
      <RouteScopedServices />
      <AppLayout />
    </QueryClientProvider>
  );
}
