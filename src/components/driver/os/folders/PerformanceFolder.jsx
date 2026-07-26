import React, { useMemo } from "react";
import { Trophy } from "lucide-react";
import { readShiftHistory, readPrefs, estimateGasPriceUsd } from "@/lib/driverHubApi";
import { collectTrips, summarizeTrips, filterTripsByPeriod } from "@/lib/driverActivity/intelligence.js";

function scoreFromSummary(s) {
  if (!s || !s.trips) return null;
  const hourly = Number(s.avg_dollars_per_hour) || 0;
  const perMi = Number(s.avg_dollars_per_mile) || 0;
  const idleRatio = s.drive_sec > 0 ? Math.min(1, (s.idle_sec || 0) / (s.drive_sec + (s.idle_sec || 0))) : 0.5;
  const profit = Number(s.profit) || 0;
  let score = 40;
  score += Math.min(25, hourly * 0.6);
  score += Math.min(20, perMi * 8);
  score += Math.min(10, Math.max(0, profit) * 0.15);
  score -= Math.min(15, idleRatio * 20);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function PerformanceFolder({ user }) {
  const data = useMemo(() => {
    if (!user?.id) return null;
    const prefs = readPrefs(user.id) || {};
    const gasUsd = estimateGasPriceUsd(prefs.zip || "");
    const { sessions } = collectTrips(readShiftHistory(user.id) || [], null, [], {
      mpg: Number(prefs.mpg) || 22,
      gasUsd: typeof gasUsd === "number" ? gasUsd : 3.5,
      userId: user.id,
    });
    const today = summarizeTrips(filterTripsByPeriod(sessions, "day"));
    const week = summarizeTrips(filterTripsByPeriod(sessions, "week"));
    const month = summarizeTrips(filterTripsByPeriod(sessions, "month"));
    const all = summarizeTrips(sessions);
    const dailyScores = [];
    const byDay = new Map();
    for (const t of sessions) {
      const d = t.date || String(t.started_at || "").slice(0, 10);
      if (!d) continue;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(t);
    }
    for (const [, rows] of byDay) {
      const sc = scoreFromSummary(summarizeTrips(rows));
      if (sc != null) dailyScores.push(sc);
    }
    const best = dailyScores.length ? Math.max(...dailyScores) : null;
    return {
      today: scoreFromSummary(today),
      week: scoreFromSummary(week),
      month: scoreFromSummary(month),
      best,
      components: {
        efficiency: week.avg_dollars_per_mile != null ? `$${week.avg_dollars_per_mile}/mi` : "—",
        profit: `$${(week.profit || 0).toFixed(0)}`,
        idle: week.idle_sec ? `${Math.round(week.idle_sec / 60)} min` : "—",
        trips: String(week.trips || 0),
        allTrips: String(all.trips || 0),
      },
    };
  }, [user?.id]);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Sign in for performance scoring.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <Trophy className="w-7 h-7" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Overall score · today</p>
          <p className="text-3xl font-bold tabular-nums text-foreground">{data.today ?? "—"}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ["Weekly trend", data.week],
          ["Monthly trend", data.month],
          ["Historical best", data.best],
          ["Trips scored", data.components.allTrips],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-muted/30 px-3 py-3">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground mt-0.5">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Components (this week)</p>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          <li className="rounded-lg border border-border px-3 py-2">Efficiency · {data.components.efficiency}</li>
          <li className="rounded-lg border border-border px-3 py-2">Profit · {data.components.profit}</li>
          <li className="rounded-lg border border-border px-3 py-2">Idle · {data.components.idle}</li>
          <li className="rounded-lg border border-border px-3 py-2">Trips · {data.components.trips}</li>
        </ul>
      </div>
    </div>
  );
}
