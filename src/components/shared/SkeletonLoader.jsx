import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonBox({ className = "", style }) {
  return <Skeleton className={className} style={style} />;
}

/** Staggered list of skeleton rows */
export function ListSkeleton({ count = 5, className }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading list">
      {[...Array(count)].map((_, i) => (
        <SkeletonBox
          key={i}
          className="h-16 rounded-lg skeleton-enter"
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading cards"
    >
      {[...Array(count)].map((_, i) => (
        <SkeletonBox
          key={i}
          className="h-56 rounded-xl skeleton-enter"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4" aria-busy="true" aria-label="Loading details">
      <SkeletonBox className="h-8 w-48 rounded-md skeleton-enter" />
      <SkeletonBox className="h-40 rounded-xl skeleton-enter" style={{ animationDelay: "40ms" }} />
      <SkeletonBox className="h-24 rounded-xl skeleton-enter" style={{ animationDelay: "80ms" }} />
      <SkeletonBox className="h-24 rounded-xl skeleton-enter" style={{ animationDelay: "120ms" }} />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-4 p-4 md:p-8"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <SkeletonBox className="h-28 rounded-xl skeleton-enter" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonBox
            key={i}
            className="h-24 rounded-lg skeleton-enter"
            style={{ animationDelay: `${i * 45}ms` }}
          />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonBox className="h-52 rounded-xl skeleton-enter" style={{ animationDelay: "120ms" }} />
        <SkeletonBox className="h-52 rounded-xl skeleton-enter" style={{ animationDelay: "160ms" }} />
      </div>
    </div>
  );
}

export default SkeletonBox;
