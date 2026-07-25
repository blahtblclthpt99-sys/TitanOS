import React, { useMemo } from "react";
import { Clock3, Route, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/driverHubApi";
import {
  buildStopLegReport,
  buildSessionChronologyCsv,
  downloadTextFile,
} from "@/lib/driverActivity";

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

/**
 * Time Between Stops cards, daily-style session summary, timeline, insights.
 */
export default function BetweenStopsPanel({
  session,
  stops,
  onRenameStop,
  tick = 0,
}) {
  const report = useMemo(
    () => {
      try {
        return buildStopLegReport(session, Array.isArray(stops) ? stops : [], { now: new Date() });
      } catch (err) {
        console.error("[BetweenStopsPanel]", err);
        return null;
      }
    },
    // tick forces live refresh while session is active
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, stops, tick]
  );

  if (!session || !report) return null;

  const { stops: cards = [], summary, insights, timeline = [], afterLast = { drive_sec: 0, miles: 0 } } =
    report;
  if (!summary || !insights) return null;

  const exportSession = () => {
    const csv = buildSessionChronologyCsv(session, stops);
    const stamp = (session.started_at || "").slice(0, 10) || "session";
    downloadTextFile(`titanos-session-${stamp}-between-stops.csv`, csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" aria-hidden="true" />
            Time between stops
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active driving time and distance between each stop — updates automatically.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={exportSession}>
          Export session
        </Button>
      </div>

      {/* Session / daily-style summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryTile label="Total stops" value={summary.totalStops} />
        <SummaryTile label="Driving time" value={formatDuration(summary.totalDrivingSec)} />
        <SummaryTile label="Stop time" value={formatDuration(summary.totalStopSec)} />
        <SummaryTile label="Session time" value={formatDuration(summary.totalSessionSec)} />
        <SummaryTile label="Business miles" value={summary.totalBusinessMiles} />
        <SummaryTile
          label="Avg drive between"
          value={formatDuration(summary.avgDriveBetweenStopsSec)}
        />
        <SummaryTile
          label="Longest drive between"
          value={formatDuration(summary.longestDriveBetweenStopsSec)}
        />
        <SummaryTile
          label="Shortest drive between"
          value={formatDuration(summary.shortestDriveBetweenStopsSec)}
        />
        <SummaryTile label="Avg miles between" value={`${summary.avgMilesBetweenStops} mi`} />
      </div>

      {/* Productivity insights */}
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Productivity insights
        </p>
        <ul className="grid sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
          <li>
            Avg minutes between stops:{" "}
            <strong className="text-foreground tabular-nums">{insights.avgMinutesBetweenStops}</strong>
          </li>
          <li>
            Avg miles between stops:{" "}
            <strong className="text-foreground tabular-nums">{insights.avgMilesBetweenStops}</strong>
          </li>
          <li>
            Longest uninterrupted drive:{" "}
            <strong className="text-foreground tabular-nums">
              {formatDuration(insights.longestUninterruptedDriveSec)}
            </strong>
          </li>
          <li>
            Total idle / stop time:{" "}
            <strong className="text-foreground tabular-nums">
              {formatDuration(insights.totalIdleSec)}
            </strong>
          </li>
          <li>
            Session driving:{" "}
            <strong className="text-foreground tabular-nums">{insights.pctDriving}%</strong>
          </li>
          <li>
            Session stopped:{" "}
            <strong className="text-foreground tabular-nums">{insights.pctStopped}%</strong>
          </li>
        </ul>
        <p className="text-[11px] text-muted-foreground mt-2">
          Informational only — helps you review hauling and delivery cadence.
        </p>
      </div>

      {/* Per-stop cards */}
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No stops yet. Drive time before the first stop will appear here when a stop is detected or
          logged.
        </p>
      ) : (
        <ul className="space-y-3">
          {cards.map((st, idx) => (
            <li
              key={st.id || `stop-${idx}`}
              className="rounded-2xl border border-border bg-card/70 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Stop {st.stopNumber}
                  {st.auto ? (
                    <span className="ml-2 text-[10px] uppercase text-primary font-bold">Auto</span>
                  ) : null}
                  {st.open ? (
                    <span className="ml-2 text-[10px] uppercase text-emerald-500 font-bold">Live</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{st.label}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <Meta label="Arrived" value={fmtTime(st.arrived_at)} />
                <Meta label="Departed" value={st.open ? "—" : fmtTime(st.departed_at)} />
                <Meta label="Stop duration" value={formatDuration(st.duration_sec)} />
                <Meta
                  label={st.stopNumber === 1 ? "Drive time since start" : `Drive time since Stop ${st.stopNumber - 1}`}
                  value={formatDuration(st.drive_since_prev_sec)}
                />
                <Meta
                  label={st.stopNumber === 1 ? "Distance since start" : `Distance since Stop ${st.stopNumber - 1}`}
                  value={`${st.miles_since_prev} mi`}
                />
                <Meta label="Running total miles" value={`${st.running_miles} mi`} />
                <Meta
                  label="Running drive time"
                  value={formatDuration(st.running_drive_sec)}
                />
              </div>
              {onRenameStop ? (
                <input
                  type="text"
                  className="w-full max-w-sm h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                  placeholder="Rename (pickup, dropoff, haul…)"
                  defaultValue={st.label?.startsWith("Stop ") ? "" : st.label}
                  onBlur={(e) => onRenameStop(st.id, e.target.value)}
                  aria-label={`Rename stop ${st.stopNumber}`}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {((afterLast?.drive_sec || 0) > 0 || (afterLast?.miles || 0) > 0) && (
        <div className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
          <Route className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            {session.ended_at ? "After last stop" : "Since last stop"}:{" "}
            <strong className="text-foreground tabular-nums">
              {formatDuration(afterLast?.drive_sec)}
            </strong>{" "}
            driving ·{" "}
            <strong className="text-foreground tabular-nums">{afterLast?.miles ?? 0} mi</strong>
          </p>
        </div>
      )}

      {/* Timeline */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
          <Clock3 className="w-3.5 h-3.5" /> Session timeline
        </p>
        <ol className="space-y-2 border-l border-border ml-2 pl-4">
          {timeline.map((ev, i) => (
            <li key={`${ev.type}-${ev.at}-${i}`} className="relative text-xs">
              <span className="absolute -left-[1.35rem] top-1 w-2.5 h-2.5 rounded-full bg-primary/80 border border-background" />
              <p className="font-medium text-foreground">
                {ev.label}
                <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                  {fmtTime(ev.at)}
                  {ev.ends_at ? ` → ${fmtTime(ev.ends_at)}` : ""}
                </span>
              </p>
              {(ev.drive_sec != null || ev.miles != null || ev.duration_sec != null) && (
                <p className="text-muted-foreground tabular-nums">
                  {ev.type === "stop"
                    ? `Stopped ${formatDuration(ev.duration_sec || 0)}`
                    : ev.type === "driving"
                      ? `${formatDuration(ev.drive_sec || 0)} · ${ev.miles ?? 0} mi`
                      : null}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
