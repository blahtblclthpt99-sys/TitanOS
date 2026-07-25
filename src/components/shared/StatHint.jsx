import React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Compact info icon + tooltip for Driver Hub / tax metrics (non-technical copy).
 */
export default function StatHint({ label, children, side = "top" }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-ring min-w-[28px] min-h-[28px] -mr-1"
            aria-label={`About ${label}`}
          >
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[240px] text-left font-normal leading-snug">
          <p className="font-semibold mb-1">{label}</p>
          <div className="text-muted-foreground space-y-1">{children}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
