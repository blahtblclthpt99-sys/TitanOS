import React from "react";

const PRESETS = {
  // Job statuses
  scheduled:   "bg-titan-cyan/15 text-titan-cyan",
  in_progress: "bg-titan-amber/15 text-titan-amber",
  completed:   "bg-emerald-500/15 text-emerald-400",
  cancelled:   "bg-red-400/15 text-red-400",
  // Invoice statuses
  draft:       "bg-white/10 text-white/50",
  sent:        "bg-titan-cyan/15 text-titan-cyan",
  viewed:      "bg-titan-indigo/15 text-titan-indigo",
  paid:        "bg-emerald-500/15 text-emerald-400",
  partial:     "bg-titan-amber/15 text-titan-amber",
  overdue:     "bg-red-400/15 text-red-400",
  // Customer statuses
  lead:        "bg-titan-amber/15 text-titan-amber",
  active:      "bg-emerald-500/15 text-emerald-400",
  inactive:    "bg-white/10 text-white/40",
  vip:         "bg-titan-indigo/15 text-titan-indigo",
  // Estimate
  accepted:    "bg-emerald-500/15 text-emerald-400",
  declined:    "bg-red-400/15 text-red-400",
  expired:     "bg-white/10 text-white/40",
};

export default function StatusBadge({ status }) {
  const label = status?.replace(/_/g, " ") ?? "—";
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize tracking-wide ${PRESETS[status] || "bg-white/10 text-white/40"}`}>
      {label}
    </span>
  );
}