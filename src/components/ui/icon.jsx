import React from "react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/design-system";

/**
 * Consistent Lucide (or any SVG) sizing + a11y.
 * Decorative by default (aria-hidden); pass title for meaningful icons.
 */
export default function Icon({
  icon: Comp,
  size = "md",
  className,
  title,
  strokeWidth = 2,
  ...props
}) {
  if (!Comp) return null;
  const decorative = !title;
  return (
    <Comp
      className={cn(ICON_SIZE[size] || ICON_SIZE.md, "shrink-0", className)}
      strokeWidth={strokeWidth}
      aria-hidden={decorative ? true : undefined}
      role={title ? "img" : undefined}
      aria-label={title}
      {...props}
    />
  );
}
