import React from "react";
import { cn } from "@/lib/utils";

/**
 * Determinate or indeterminate progress — soft, non-distracting.
 */
export default function ProgressBar({
  value = null,
  label,
  className,
  size = "sm",
}) {
  const determinate = typeof value === "number" && Number.isFinite(value);
  const pct = determinate ? Math.max(0, Math.min(100, value)) : null;
  const height = size === "md" ? "h-1.5" : "h-1";

  return (
    <div
      className={cn("w-full", className)}
      role="progressbar"
      aria-label={label || "Progress"}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(pct) : undefined}
      aria-valuetext={determinate ? `${Math.round(pct)}%` : "Loading"}
    >
      {label ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {determinate ? (
            <span className="text-xs tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
          ) : null}
        </div>
      ) : null}
      {determinate ? (
        <div className={cn("overflow-hidden rounded-full bg-muted", height)}>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-base ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className={cn("titan-loading-bar", height)} aria-hidden="true" />
      )}
    </div>
  );
}
