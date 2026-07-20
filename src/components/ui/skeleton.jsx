import { cn } from "@/lib/utils";

/**
 * Loading placeholder — respects reduced motion via CSS.
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
