import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Honest beta / preview callout — use whenever a feature looks live but is demo,
 * local-only, stubbed, or not wired to production providers.
 */
export default function FeatureHonestyBanner({
  children,
  className,
  tone = "warning",
}) {
  const tones = {
    warning: "border-warning/35 bg-warning/10 text-foreground",
    info: "border-primary/25 bg-primary/10 text-foreground",
    muted: "border-border bg-muted/50 text-muted-foreground",
  };

  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex gap-3 rounded-md border px-4 py-3 text-xs leading-relaxed",
        tones[tone] || tones.warning,
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
