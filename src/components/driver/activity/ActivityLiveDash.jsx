import React from "react";
import { Gauge, MapPin, Pause, Play, Timer } from "lucide-react";
import StatHint from "@/components/shared/StatHint";
import { formatDuration, IRS_MILEAGE_RATE_USD } from "@/lib/driverHubApi";
import { cn } from "@/lib/utils";

/**
 * Large, glanceable live driving dashboard — drive timer and idle timer are separate.
 */
export default function ActivityLiveDash({
  dash,
  stopPhase,
  paused,
  milesSource,
  onPause,
  onResume,
  busy,
  rushLabel,
}) {
  if (!dash) return null;

  const statusLabel =
    paused
      ? "Paused"
      : stopPhase === "stopped"
        ? "At stop · idle timer running"
        : stopPhase === "potential"
          ? "Possible stop"
          : "Driving · drive timer running";

  const statusColor = paused
    ? "text-titan-amber"
    : stopPhase === "stopped"
      ? "text-titan-amber"
      : "text-emerald-500";

  const drivingNow = !paused && stopPhase !== "stopped" && stopPhase !== "potential";
  const idlingNow = !paused && (stopPhase === "stopped" || stopPhase === "potential");

  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
            Live work session
          </p>
          <p className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</p>
          {rushLabel ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">{rushLabel}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {paused ? (
            <button
              type="button"
              onClick={onResume}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 h-10 text-xs font-semibold text-emerald-400"
              aria-label="Resume tracking"
            >
              <Play className="w-4 h-4" /> Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-xl bg-muted border border-border px-3 h-10 text-xs font-semibold text-muted-foreground"
              aria-label="Pause tracking"
            >
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
        </div>
      </div>

      {/* Separate drive vs idle clocks — primary focus */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div
          className={cn(
            "rounded-2xl border px-4 py-4 text-center",
            drivingNow
              ? "border-emerald-500/50 bg-emerald-500/15 shadow-[0_0_24px_rgba(16,185,129,0.15)]"
              : "border-border bg-background/50"
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1 flex items-center justify-center gap-1">
            <Timer className="w-3.5 h-3.5" /> Drive timer
          </p>
          <p className="text-3xl sm:text-4xl font-bold tabular-nums text-foreground tracking-tight">
            {formatDuration(dash.driveSec || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Moving time only</p>
        </div>
        <div
          className={cn(
            "rounded-2xl border px-4 py-4 text-center",
            idlingNow
              ? "border-titan-amber/50 bg-titan-amber/10 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
              : "border-border bg-background/50"
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-titan-amber mb-1 flex items-center justify-center gap-1">
            <Timer className="w-3.5 h-3.5" /> Idle timer
          </p>
          <p className="text-3xl sm:text-4xl font-bold tabular-nums text-foreground tracking-tight">
            {formatDuration(dash.idleSec || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Stopped / waiting</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3 text-center">
        Total session clock:{" "}
        <span className="tabular-nums text-foreground font-semibold">
          {formatDuration(dash.elapsedSec || 0)}
        </span>{" "}
        (drive + idle; pauses excluded)
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-xl bg-background/50 border border-border px-3 py-3">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            Trip miles
            <StatHint label="Trip miles">
              <p>
                {milesSource === "gps"
                  ? "Auto-recorded from GPS during this work session."
                  : "Manually entered or corrected."}
              </p>
            </StatHint>
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{dash.miles}</p>
        </div>
        <div className="rounded-xl bg-background/50 border border-border px-3 py-3">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Trips / stops
            <StatHint label="Detected trips">
              <p>Each confirmed stop closes one trip leg with its own drive and idle times.</p>
            </StatHint>
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{dash.stops}</p>
        </div>
        <div className="rounded-xl bg-background/50 border border-border px-3 py-3 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <Gauge className="w-3 h-3" /> Speed
          </p>
          <p className="text-lg font-bold text-foreground tabular-nums">
            {dash.avgSpeedMph > 0 ? `Avg ${dash.avgSpeedMph}` : "—"}
            {dash.maxSpeedMph > 0 ? ` · Max ${dash.maxSpeedMph}` : ""} mph
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            Avg stop
            <StatHint label="Average stop duration">
              <p>Average idle time of completed stops this session.</p>
            </StatHint>
          </p>
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {formatDuration(dash.avgStopSec)}
          </p>
        </div>
        <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            Deductible est.
            <StatHint label="Business mileage estimate">
              <p>
                Miles × IRS standard rate (${IRS_MILEAGE_RATE_USD}/mi) for recordkeeping — not tax
                advice.
              </p>
            </StatHint>
          </p>
          <p className="text-sm font-semibold text-emerald-500 tabular-nums">
            ${(Number(dash.taxEstimate) || 0).toFixed(0)}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Drive and idle timers run separately. Every trip is saved for your end-of-day spreadsheet
        report in Logbook
        {milesSource === "gps" ? " · GPS miles on" : " · manual miles"}.
      </p>
    </div>
  );
}
