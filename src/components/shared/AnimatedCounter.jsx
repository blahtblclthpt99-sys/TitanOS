import React, { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * AnimatedCounter — premium count-up for KPIs.
 * Skips animation when reduced motion is on; never blocks interaction.
 */
export default function AnimatedCounter({
  value = 0,
  duration = 600,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  format,
}) {
  const reduceMotion = usePrefersReducedMotion();
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(reduceMotion ? target : 0);
  const fromRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(target);
      fromRef.current = target;
      return undefined;
    }

    const from = fromRef.current;
    const start = performance.now();
    const delta = target - from;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic — snappy, not sluggish
      const eased = 1 - (1 - t) ** 3;
      const next = from + delta * eased;
      setDisplay(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, reduceMotion]);

  const formatted =
    typeof format === "function"
      ? format(display)
      : `${prefix}${display.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`;

  return (
    <span className={cn("tabular-nums", className)} aria-label={String(formatted)}>
      {formatted}
    </span>
  );
}
