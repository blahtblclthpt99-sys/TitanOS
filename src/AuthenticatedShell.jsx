import React, { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import AppLayout from "@/components/layout/AppLayout";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import DriverSessionKeepAlive from "@/components/driver/activity/DriverSessionKeepAlive";
import DoorDashKeepAlive from "@/components/driver/activity/DoorDashKeepAlive";
import PlayEntitlementSync from "@/components/billing/PlayEntitlementSync";
import { useAuth } from "@/lib/AuthContext";
import { setSearchIndexUser, warmSearchIndex } from "@/lib/searchIndex";
import { trackEvent } from "@/lib/productAnalytics";
import { refreshFeatureFlagsFromServer } from "@/lib/featureFlags";
import { runWhenIdle } from "@/lib/perf";
import ScheduledExportRunner from "@/components/shared/ScheduledExportRunner";

function allowsBackgroundWarmup() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return false;

  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  if (connection?.saveData) return false;

  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  return effectiveType !== "slow-2g" && effectiveType !== "2g";
}

function PrefetchOnMount() {
  const { user } = useAuth();
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const shouldPrefetchDashboard = Boolean(user?.id) && (path === "/" || path === "/dashboard");
  usePrefetchDashboard(shouldPrefetchDashboard);

  useEffect(() => {
    if (!user?.id) return undefined;

    const userId = user.id;
    setSearchIndexUser(userId);
    trackEvent("session_start");

    // Flags are useful globally, but they are not allowed to compete with
    // authentication, route code, or the first data paint.
    const cancelFlags = runWhenIdle(() => {
      if (document.visibilityState !== "hidden") {
        refreshFeatureFlagsFromServer().catch(() => {});
      }
    }, 2500);

    // The search index previously duplicated dashboard Jobs/Customers/Invoices
    // requests during startup. Give the active route time to populate the index
    // first, and skip remote warming entirely on data-saver / very slow links.
    let cancelSearchIdle = () => {};
    const searchTimer = window.setTimeout(() => {
      cancelSearchIdle = runWhenIdle(() => {
        if (allowsBackgroundWarmup()) {
          warmSearchIndex(userId).catch(() => {});
        }
      }, 5000);
    }, 6000);

    return () => {
      cancelFlags?.();
      window.clearTimeout(searchTimer);
      cancelSearchIdle?.();
    };
  }, [user?.id]);

  return null;
}

/** Authenticated app shell — keeps react-query out of the marketing bundle. */
export default function AuthenticatedShell() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <PrefetchOnMount />
      <PlayEntitlementSync />
      <ScheduledExportRunner />
      <DriverSessionKeepAlive />
      <DoorDashKeepAlive />
      <AppLayout />
    </QueryClientProvider>
  );
}
