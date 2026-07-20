import React from "react";
import { cn } from "@/lib/utils";
import ProgressBar from "@/components/shared/ProgressBar";

/** Centered spinner. Use fullScreen for page-level loading. */
export default function Spinner({ size = "md", fullScreen = false, label = "Loading", className }) {
  const sz = { sm: "w-5 h-5 border-2", md: "w-8 h-8 border-2", lg: "w-12 h-12 border-[3px]" }[size];
  const containerClass = fullScreen
    ? "flex flex-col items-center justify-center gap-4 h-screen"
    : "flex flex-col items-center justify-center gap-4 py-20";

  return (
    <div className={cn(containerClass, className)} role="status" aria-live="polite" aria-label={label}>
      <div
        className={cn(
          sz,
          "rounded-full border-primary/20 border-t-primary animate-spin"
        )}
        aria-hidden="true"
      />
      <ProgressBar className="w-32" />
      <span className="sr-only">{label}</span>
      {!fullScreen ? (
        <p className="text-xs text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
