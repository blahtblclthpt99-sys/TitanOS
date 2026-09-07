import React, { Suspense, lazy, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import AppLayout from "@/components/layout/AppLayout";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import DriverSessionKeepAlive from "@/components/driver/activity/DriverSessionKeepAlive";
import DoorDashKeepAlive from "@/components/driver/activity/DoorDashKeepAlive";
import { useAuth } from "@/lib/AuthContext";
import { scheduleIdleWork } from "@/lib/idleWork";

const ScheduledExportRunner = lazy(() => import("@/components/shared/ScheduledExportRunner"));

function PrefetchOnMount() {
  usePrefetchDashboard(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;
    const cancel = scheduleIdleWork(
      () => {
        // These features improve the session after paint, but none is required
        // to render the route the user opened. Dynamic imports also keep their
        // supporting code out of the immediate authenticated-shell download.
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
      { delay: 750, timeout: 3000 }
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
        delay: 1500,
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

/** Authenticated app shell — keeps react-query out of the marketing bundle. */
export default function AuthenticatedShell() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <PrefetchOnMount />
      <DeferredScheduledExports />
      {/* Active driver telemetry must remain immediate; never idle-defer it. */}
      <DriverSessionKeepAlive />
      <DoorDashKeepAlive />
      <AppLayout />
    </QueryClientProvider>
  );
}
