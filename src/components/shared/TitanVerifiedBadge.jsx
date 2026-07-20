import React from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Titan Verified Badge — earned trust mark for verified pros & drivers.
 *
 * @param {"sm"|"md"|"lg"} [size]
 * @param {boolean} [showLabel] — show "Titan Verified" text
 */
export default function TitanVerifiedBadge({
  size = "md",
  showLabel = true,
  className,
  title = "Titan Verified — identity and trust checks passed",
}) {
  const sizes = {
    sm: { wrap: "gap-1 px-1.5 py-0.5 text-[10px]", icon: "h-3 w-3" },
    md: { wrap: "gap-1.5 px-2.5 py-1 text-xs", icon: "h-3.5 w-3.5" },
    lg: { wrap: "gap-2 px-3 py-1.5 text-sm", icon: "h-4 w-4" },
  };
  const s = sizes[size] || sizes.md;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-primary/15 font-semibold text-primary ring-1 ring-primary/25",
        s.wrap,
        className
      )}
      title={title}
    >
      <BadgeCheck className={cn(s.icon, "flex-shrink-0")} aria-hidden="true" />
      {showLabel ? <span>Titan Verified</span> : <span className="sr-only">Titan Verified</span>}
    </span>
  );
}
