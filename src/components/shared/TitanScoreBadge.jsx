import React from "react";
import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact Titan Score chip for cards and headers.
 *
 * @param {number} score
 * @param {string} [grade]
 * @param {string} [href] — default /titan-score
 * @param {"sm"|"md"} [size]
 */
export default function TitanScoreBadge({
  score,
  grade,
  href = "/titan-score",
  size = "sm",
  className,
  asLink = true,
}) {
  const n = Math.round(Number(score) || 0);
  const label = grade || (n >= 90 ? "A+" : n >= 80 ? "A" : n >= 70 ? "B" : n >= 55 ? "C" : "D");

  const inner = (
    <>
      <Award className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
      <span className="tabular-nums font-bold">{n}</span>
      <span className="font-medium opacity-80">{label}</span>
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-1 rounded-md bg-muted font-semibold text-foreground ring-1 ring-border",
    size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]",
    asLink && "hover:bg-muted/80 focus-ring",
    className
  );

  if (asLink && href) {
    return (
      <Link to={href} className={classes} title={`Titan Score ${n} (${label})`}>
        {inner}
      </Link>
    );
  }

  return (
    <span className={classes} title={`Titan Score ${n} (${label})`}>
      {inner}
    </span>
  );
}
