import React from "react";
import ProgressBar from "@/components/shared/ProgressBar";
import {
  CardGridSkeleton,
  DashboardSkeleton,
  DetailSkeleton,
  ListSkeleton,
} from "@/components/shared/SkeletonLoader";

/**
 * Full-page loading — skeleton shape + soft progress cue.
 */
export default function PageLoader({ variant = "list", label = "Loading", count }) {
  return (
    <div className="page-pad mx-auto w-full max-w-6xl" role="status" aria-live="polite" aria-label={label}>
      <ProgressBar className="mb-4 max-w-xs" label={label} />
      {variant === "dashboard" ? (
        <DashboardSkeleton />
      ) : variant === "cards" ? (
        <CardGridSkeleton count={count || 6} />
      ) : variant === "detail" ? (
        <DetailSkeleton />
      ) : (
        <ListSkeleton count={count || 5} />
      )}
    </div>
  );
}
