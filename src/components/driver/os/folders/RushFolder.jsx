import React, { useMemo } from "react";
import {
  DEFAULT_RUSH_WINDOWS,
  classifyRushWindow,
  collectTrips,
  summarizeTrips,
  weeklyByWeekday,
  weekdayWeekendCompare,
} from "@/lib/driverActivity/intelligence.js";
import { readShiftHistory } from "@/lib/driverHubApi";

export default function RushFolder({ user }) {
  const { byRush, weekdays, compare } = useMemo(() => {
    if (!user?.id) return { byRush: [], weekdays: null, compare: null };
    const history = readShiftHistory(user.id) || [];
    const { sessions } = collectTrips(history);
    const byRush = DEFAULT_RUSH_WINDOWS.map((w) => {
      const subset = sessions.filter((t) => {
        const started = t.started_at || t.startedAt;
        if (!started) return false;
        return classifyRushWindow(new Date(started)).id === w.id;
      });
      return { window: w, count: subset.length, summary: summarizeTrips(subset) };
    });
    return {
      byRush,
      weekdays: weeklyByWeekday(sessions),
      compare: weekdayWeekendCompare(sessions),
    };
  }, [user?.id]);

  if (!user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in for rush intelligence.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Default windows: Breakfast 6–9 · Lunch 11–2 · Afternoon 2–5 · Dinner 5–8 · Late 8–12 · Overnight 12–6
      </p>
      <div className="space-y-2">
        {byRush.map(({ window: w, count, summary }) => (
          <details key={w.id} className="rounded-xl border border-border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold min-h-[40px] flex items-center justify-between gap-2">
              <span>{w.label}</span>
              <span className="text-xs text-muted-foreground font-normal">{count} trips</span>
            </summary>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                Avg $/hr{" "}
                <span className="text-foreground">
                  {summary.avg_dollars_per_hour != null ? `$${summary.avg_dollars_per_hour}` : "—"}
                </span>
              </div>
              <div>
                Avg $/mi{" "}
                <span className="text-foreground">
                  {summary.avg_dollars_per_mile != null ? `$${summary.avg_dollars_per_mile}` : "—"}
                </span>
              </div>
              <div>
                Miles <span className="text-foreground">{summary.miles ?? "—"}</span>
              </div>
              <div>
                Earnings <span className="text-foreground">${(summary.earnings || 0).toFixed(0)}</span>
              </div>
              <div>
                Profit <span className="text-foreground">${(summary.profit || 0).toFixed(0)}</span>
              </div>
              <div>
                Idle <span className="text-foreground">{summary.idle_sec ? `${Math.round(summary.idle_sec / 60)}m` : "—"}</span>
              </div>
            </dl>
          </details>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Weekday analysis</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(weekdays?.days || []).map((d) => (
            <div key={d.name} className="rounded-xl border border-border px-2.5 py-2 text-xs">
              <p className="font-semibold text-foreground">{d.name}</p>
              <p className="text-muted-foreground">
                {d.trips} trips · ${(d.earnings || 0).toFixed(0)}
              </p>
            </div>
          ))}
        </div>
        {weekdays?.best_day?.name ? (
          <p className="text-xs text-sky-300 mt-2">
            AI: {weekdays.best_day.name} consistently leads (~$
            {(weekdays.best_day.earnings || 0).toFixed(0)}).
            {compare?.recommendation ? ` ${compare.recommendation}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
