import React from "react";
import { Lock, Sparkles } from "lucide-react";

/** Availability notice for tools not enabled in the current workspace. */
export default function PremiumGate({
  title = "Tool unavailable",
  description = "This tool is not enabled in the current workspace.",
  compact = false,
  children,
}) {
  return (
    <div className={compact ? "rounded-xl border border-titan-amber/30 bg-titan-amber/5 p-4" : "titan-surface space-y-4 p-6 text-center md:p-8"}>
      <div className={compact ? "flex items-start gap-3 text-left" : "space-y-3"}>
        <div className={compact ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-titan-amber/15" : "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-titan-amber/15"}>
          <Lock className="h-5 w-5 text-titan-amber" aria-hidden="true" />
        </div>
        <div className={compact ? "min-w-0 flex-1" : ""}>
          <p className="flex items-center justify-center gap-2 font-semibold text-foreground md:justify-start">
            {!compact && <Sparkles className="h-4 w-4 text-titan-cyan" aria-hidden="true" />}
            {title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
