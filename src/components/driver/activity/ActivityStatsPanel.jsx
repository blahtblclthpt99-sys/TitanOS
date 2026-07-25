import React, { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatHint from "@/components/shared/StatHint";
import { computeActivityStats, buildMileageCsv, downloadTextFile, summarizeBetweenStopsDaily } from "@/lib/driverActivity";
import { formatDuration, IRS_MILEAGE_RATE_USD } from "@/lib/driverHubApi";

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {label}
        {hint}
      </p>
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Auto-updating period stats + tax recordkeeping export (not tax advice).
 */
export default function ActivityStatsPanel({ history, liveSession, stops }) {
  const stats = useMemo(
    () => computeActivityStats(history, liveSession),
    [history, liveSession]
  );

  const todayBetween = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = (history || []).filter((h) => (h.started_at || "").slice(0, 10) === today);
    if (liveSession?.active) {
      rows.unshift({ ...liveSession, stops_detail: stops || [] });
    }
    return summarizeBetweenStopsDaily(rows);
  }, [history, liveSession, stops]);

  const exportCsv = () => {
    const bySession = {};
    if (liveSession?.id && stops?.length) bySession[liveSession.id] = stops;
    for (const h of history || []) {
      if (h.stops_detail?.length) bySession[h.id] = h.stops_detail;
    }
    const csv = buildMileageCsv(history || [], bySession);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`titanos-driver-mileage-${stamp}.csv`, csv);
  };

  const periods = [
    { key: "today", title: "Today" },
    { key: "week", title: "This week" },
    { key: "month", title: "This month" },
  ];

  return (
    <div className="titan-surface p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Driver statistics</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Updated automatically from work sessions — correct entries only when needed.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Today · time between stops
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Stops" value={todayBetween.totalStops} />
          <StatCard label="Drive time" value={formatDuration(todayBetween.totalDrivingSec)} />
          <StatCard label="Stop time" value={formatDuration(todayBetween.totalStopSec)} />
          <StatCard label="Session time" value={formatDuration(todayBetween.totalSessionSec)} />
          <StatCard
            label="Avg between"
            value={formatDuration(todayBetween.avgDriveTimeBetweenStopsSec)}
          />
          <StatCard
            label="Longest between"
            value={formatDuration(todayBetween.longestDriveBetweenStopsSec)}
          />
          <StatCard
            label="Shortest between"
            value={formatDuration(todayBetween.shortestDriveBetweenStopsSec)}
          />
          <StatCard label="Avg mi between" value={`${todayBetween.avgDistanceBetweenStops} mi`} />
        </div>
      </div>

      {periods.map(({ key, title }) => {
        const s = stats[key];
        return (
          <div key={key}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              {title}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label="Miles" value={s.miles} />
              <StatCard label="Trips" value={s.trips} />
              <StatCard label="Stops" value={s.stops} />
              <StatCard
                label="Drive hrs"
                value={s.driveHours}
                hint={
                  <StatHint label="Driving hours">
                    <p>Active moving time across sessions.</p>
                  </StatHint>
                }
              />
              <StatCard label="Idle hrs" value={s.idleHours} />
              <StatCard label="Avg trip" value={`${s.avgTripLength} mi`} />
              <StatCard label="Longest" value={`${s.longestTrip} mi`} />
              <StatCard
                label="Deductible est."
                value={`$${s.deductibleEstimateUsd}`}
                hint={
                  <StatHint label="Deductible mileage estimate">
                    <p>
                      Business miles × ${IRS_MILEAGE_RATE_USD}/mi (IRS standard rate) for
                      recordkeeping only — not tax or legal advice.
                    </p>
                  </StatHint>
                }
              />
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-border/80 bg-muted/30 p-3 flex gap-3">
        <FileSpreadsheet className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Tax assistant</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Export dates, miles, drive/idle time, and stops for your records or accountant. TitanOS
            does not calculate your taxes or provide tax advice. Official IRS rules may differ —
            keep supporting documentation.
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
            All-time logged: {stats.all.miles} mi · {formatDuration(stats.all.driveSec)} drive · $
            {stats.all.deductibleEstimateUsd} deductible est.
          </p>
        </div>
      </div>
    </div>
  );
}
