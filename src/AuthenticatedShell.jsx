import React, { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "react-router";
import { queryClientInstance } from "@/lib/query-client";
import AppLayout from "@/components/layout/AppLayout";
import PlayEntitlementSync from "@/components/billing/PlayEntitlementSync";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import { useAuth } from "@/lib/AuthContext";
import { trackEvent } from "@/lib/productAnalytics";
import { refreshFeatureFlagsFromServer } from "@/lib/featureFlags";
import { runWhenIdle } from "@/lib/perf";

function CoreBoot() {
  const { user } = useAuth();
  const location = useLocation();
  const shouldPrefetchDashboard =
    Boolean(user?.id) && (location.pathname === "/" || location.pathname === "/dashboard");

  usePrefetchDashboard(shouldPrefetchDashboard);

  useEffect(() => {
    if (!user?.id) return undefined;

    trackEvent("session_start");
    const cancelFlags = runWhenIdle(() => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        refreshFeatureFlagsFromServer().catch(() => {});
      }
    }, 2500);

    return () => cancelFlags?.();
  }, [user?.id]);

  return null;
}

/**
 * Authenticated TitanOS core shell.
 * Heavy/background services stay opt-in; dashboard data is warmed only for the
 * dashboard route, and Android Play reconciliation runs after startup idle.
 */
export default function AuthenticatedShell() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <CoreBoot />
      <PlayEntitlementSync />
      <AppLayout />
    </QueryClientProvider>
  );
}
