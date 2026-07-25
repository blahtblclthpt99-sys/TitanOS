import React from "react";

/**
 * TitanOS wordmark — "Titan" + cyan "OS", optional tagline.
 * Colors adapt via CSS classes for light/dark.
 */
export default function TitanWordmark({
  className = "",
  showTagline = false,
  size = "md",
}) {
  const titleClass =
    size === "lg"
      ? "text-2xl sm:text-3xl"
      : size === "sm"
        ? "text-base"
        : "text-lg";

  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span className={`font-bold tracking-tight ${titleClass}`}>
        <span className="text-foreground dark:text-white">Titan</span>
        <span className="bg-gradient-to-r from-[#2563EB] to-[#22D3EE] bg-clip-text text-transparent">
          OS
        </span>
      </span>
      {showTagline ? (
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Platform for Modern Business
        </span>
      ) : null}
    </span>
  );
}
