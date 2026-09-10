import React, { Suspense, lazy, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import AppLayout from "@/components/layout/AppLayout";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import { useAuth } from "@/lib/AuthContext";
import { normalizeAppPath } from "@/lib/routing";
import { scheduleIdleWork } from "@/lib/idleWork";

// Background services stay out of the initial shell parse/execute path. Driver
// telemetry begins loading immediately after the shell commits; non-critical
// export work is additionally held until an idle window.
const ScheduledExportRunner = lazy(() => import("@/components/shared/ScheduledExportRunner"));
const DriverSessionKeepAlive = lazy(() => import("@/components/driver/activity/DriverSessionKeepAlive"));
const DoorDashKeepAlive = lazy(() => import("@/components/driver/activity/DoorDashKeepAlive"));

function PrefetchOnMount() {
  const location = useLocation();
  const { user } = useAuth();
  const isDashboard = normalizeAppPath(location.pathname) === "/";

  // Deep links should never pay for unrelated Dashboard traffic. On Dashboard,
  // warming is still delayed so the visible route gets first claim on startup.
  usePrefetchDashboard(isDashboard);

  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;
    const cancel = scheduleIdleWork(
      () => {
        // Search warming can read hundreds of records and analytics/feature flag
        // refreshes also create startup requests. Load and run them after paint.
        void Promise.all([
          import("@/lib/searchIndex"),
          import("@/lib/productAnalytics"),
          import("@/lib/featureFlags"),
        ])
          .then(([search, analytics, featureFlags]) => {
            if (!active) return;
            analytics.trackEvent("session_start");
            void featureFlags.refreshFeatureFlagsFromServer().catch(() => {});
            void search.warmSearchIndex(user.id).catch(() => {});
          })
          .catch(() => {});
      },
      { delay: 700, timeout: 2500 }
    );

    return () => {
      active = false;
      cancel();
    };
  }, [user?.id]);

  return null;
}

function DeferredScheduledExports() {
  const [ready, setReady] = useState(false);

  useEffect(
    () =>
      scheduleIdleWork(() => setReady(true), {
        delay: 1250,
        timeout: 4000,
      }),
    []
  );

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <ScheduledExportRunner />
    </Suspense>
  );
}

function BackgroundServices() {
  return (
    <>
      {/* Driver telemetry is not idle-deferred: active sessions resume promptly. */}
      <Suspense fallback={null}>
        <DriverSessionKeepAlive />
      </Suspense>
      <Suspense fallback={null}>
        <DoorDashKeepAlive />
      </Suspense>
      <DeferredScheduledExports />
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
