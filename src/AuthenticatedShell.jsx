import React, { Suspense, lazy, useEffect } from "react";
import { useLocation } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import AppLayout from "@/components/layout/AppLayout";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import { useAuth } from "@/lib/AuthContext";
import { warmSearchIndex } from "@/lib/searchIndex";
import { trackEvent } from "@/lib/productAnalytics";
import { refreshFeatureFlagsFromServer } from "@/lib/featureFlags";
import { normalizeAppPath } from "@/lib/routing";

// Keep non-critical background subsystems out of the authenticated shell's
// initial parse/execute path. They still mount immediately after the shell
// commits, preserving active driver/session behavior while allowing the UI to
// become interactive first.
const ScheduledExportRunner = lazy(() => import("@/components/shared/ScheduledExportRunner"));
const DriverSessionKeepAlive = lazy(() => import("@/components/driver/activity/DriverSessionKeepAlive"));
const DoorDashKeepAlive = lazy(() => import("@/components/driver/activity/DoorDashKeepAlive"));

function PrefetchOnMount() {
  const location = useLocation();
  const { user } = useAuth();
  const isDashboard = normalizeAppPath(location.pathname) === "/";

  // Only prefetch dashboard datasets when the dashboard is actually the active
  // destination. Deep links should not pay for unrelated dashboard traffic.
  usePrefetchDashboard(isDashboard);

  useEffect(() => {
    if (user?.id) {
      warmSearchIndex(user.id).catch(() => {});
      trackEvent("session_start");
      refreshFeatureFlagsFromServer().catch(() => {});
    }
  }, [user?.id]);
  return null;
}

function BackgroundServices() {
  return (
    <>
      <Suspense fallback={null}>
        <ScheduledExportRunner />
      </Suspense>
      <Suspense fallback={null}>
        <DriverSessionKeepAlive />
      </Suspense>
      <Suspense fallback={null}>
        <DoorDashKeepAlive />
      </Suspense>
    </>
  );
}

/** Authenticated app shell — keeps react-query out of the marketing bundle. */
export default function AuthenticatedShell() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <PrefetchOnMount />
      <AppLayout />
      <BackgroundServices />
    </QueryClientProvider>
  );
}
