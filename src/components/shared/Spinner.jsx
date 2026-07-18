import React from "react";

/** Centered spinner. Use fullScreen for page-level loading. */
export default function Spinner({ size = "md", fullScreen = false, label = "Loading" }) {
  const sz = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" }[size];
  const containerClass = fullScreen
    ? "flex items-center justify-center h-screen"
    : "flex items-center justify-center py-20";

  return (
    <div className={containerClass} role="status" aria-live="polite" aria-label={label}>
      <div
        className={`${sz} border-2 border-titan-cyan/20 border-t-titan-cyan rounded-full animate-spin`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
