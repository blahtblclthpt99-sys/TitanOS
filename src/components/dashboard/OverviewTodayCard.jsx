import React, { useId, useMemo } from "react";
import { Link } from "react-router";
import { ArrowUpRight, TrendingUp } from "lucide-react";

/**
 * "Overview · Today's Summary" strip — matches product UI references.
 */
export default function OverviewTodayCard({
  jobsCompleted = 0,
  jobsToday = 0,
  onTimePct = null,
  onTimeDelta = null,
  goalPct = 0,
}) {
  const gradId = useId().replace(/:/g, "");
  const pct = Math.max(0, Math.min(100, Math.round(Number(goalPct) || 0)));
  const arc = useMemo(() => {
    const r = 36;
    const c = Math.PI * r;
    const dash = (pct / 100) * c;
    return { dash, gap: c - dash };
  }, [pct]);

  return (
    <section
      className="titan-surface titan-depth-card mb-5 overflow-hidden p-4 sm:p-5 md:p-6"
      aria-label="Today's overview"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Overview</h2>
          <p className="text-xs text-muted-foreground">Today&apos;s Summary</p>
        </div>
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-ring"
        >
          View Report <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="titan-overview-grid">
        <div className="titan-overview-cell titan-overview-cell-primary">
          <p className="text-[11px] font-medium text-muted-foreground">Jobs Completed</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {jobsCompleted}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            of {jobsToday} scheduled today
          </p>
        </div>

        <div className="titan-overview-cell flex flex-col items-center justify-center">
          <svg width="96" height="56" viewBox="0 0 96 56" aria-hidden="true" className="overflow-visible">
            <path
              d="M12 52 A36 36 0 0 1 84 52"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M12 52 A36 36 0 0 1 84 52"
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              className="transition-[stroke-dasharray] duration-500"
            />
            <defs>
              <linearGradient id={gradId} x1="12" y1="52" x2="84" y2="20">
                <stop stopColor="#2563EB" />
                <stop offset="1" stopColor="#22D3EE" />
              </linearGradient>
            </defs>
          </svg>
          <p className="text-lg font-bold tabular-nums text-foreground -mt-1">{pct}%</p>
          <p className="text-[10px] text-muted-foreground">completion today</p>
        </div>

        <div className="titan-overview-cell">
          <p className="text-[11px] font-medium text-muted-foreground">On Time</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {onTimePct != null ? `${Math.round(onTimePct)}%` : "—"}
          </p>
          {onTimeDelta != null && Number.isFinite(onTimeDelta) ? (
            <p
              className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
                onTimeDelta >= 0 ? "text-emerald-500" : "text-destructive"
              }`}
            >
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              {onTimeDelta >= 0 ? "+" : ""}
              {Math.round(onTimeDelta)}%
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">No comparison yet</p>
          )}
        </div>
      </div>
    </section>
  );
}
