import React from "react";

function SkeletonBox({ className = "" }) {
  return <div className={`bg-white/5 rounded-xl animate-pulse ${className}`} aria-hidden="true" />;
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <SkeletonBox className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <SkeletonBox key={i} className="h-20 rounded-2xl" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <SkeletonBox className="h-48 rounded-2xl" />
        <SkeletonBox className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading list">
      {[...Array(count)].map((_, i) => (
        <SkeletonBox key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

export default SkeletonBox;
