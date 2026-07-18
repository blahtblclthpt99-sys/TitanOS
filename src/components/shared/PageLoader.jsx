import React from "react";
import Spinner from "@/components/shared/Spinner";
import { DashboardSkeleton, ListSkeleton } from "@/components/shared/SkeletonLoader";

/**
 * Standardized loading UI for pages.
 * - dashboard: skeleton matching Dashboard layout
 * - list: skeleton rows for list/table pages
 * - detail: centered spinner for detail views
 * - fullscreen: full-screen spinner (auth, suspense)
 */
export default function PageLoader({ variant = "list", label = "Loading" }) {
  if (variant === "dashboard") {
    return (
      <div aria-busy="true" aria-live="polite" aria-label={label}>
        <DashboardSkeleton />
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto" aria-busy="true" aria-live="polite" aria-label={label}>
        <div className="h-10 w-48 bg-white/5 rounded-xl animate-pulse mb-6" />
        <ListSkeleton count={6} />
      </div>
    );
  }

  if (variant === "detail") {
    return <Spinner label={label} />;
  }

  return <Spinner fullScreen label={label} />;
}
