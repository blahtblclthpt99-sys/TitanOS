import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

const MAX = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

/**
 * Standard page chrome — consistent padding, width, and bottom clearance
 * for mobile nav / FABs so every screen feels like the same product.
 */
const PageShell = forwardRef(function PageShell(
  { children, maxWidth = "lg", className, dense = false, style },
  ref
) {
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "page-pad mx-auto w-full overflow-x-hidden",
        dense ? "pb-24" : "pb-28 md:pb-10",
        MAX[maxWidth] || MAX.lg,
        className
      )}
    >
      {children}
    </div>
  );
});

export default PageShell;
