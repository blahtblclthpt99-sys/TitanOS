import React from "react";
import { cn } from "@/lib/utils";
import { PRESSABLE } from "@/lib/interaction";

/**
 * Segmented filter / status chip — consistent selected state + a11y + press.
 */
export default function FilterChip({
  children,
  active = false,
  onClick,
  className,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        PRESSABLE,
        "inline-flex items-center justify-center min-h-[44px] px-3.5 rounded-md text-xs font-semibold whitespace-nowrap capitalize focus-ring",
        active
          ? "bg-primary/10 text-primary border border-primary/25"
          : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-muted/60",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
