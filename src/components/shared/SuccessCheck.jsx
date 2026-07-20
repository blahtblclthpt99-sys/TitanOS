import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Brief success glyph — use after saves / completes */
export default function SuccessCheck({ className, size = "md" }) {
  const box = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div
      className={cn(
        "success-pop inline-flex items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/25",
        box,
        className
      )}
      role="img"
      aria-label="Success"
    >
      <Check className={icon} aria-hidden="true" strokeWidth={2.5} />
    </div>
  );
}
