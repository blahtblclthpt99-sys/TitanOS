import React from "react";
import { Gauge, MapPin, Pause, Play, Timer } from "lucide-react";
import StatHint from "@/components/shared/StatHint";
import { formatDuration, IRS_MILEAGE_RATE_USD } from "@/lib/driverHubApi";

/**
 * Large, glanceable live driving dashboard — minimize interaction while moving.
 */
export default function ActivityLiveDash({
  dash,
  stopPhase,
  paused,
  milesSource,
  onPause,
  onResume,
  busy,
}) {
  if (!dash) return null;

  const statusLabel =
    paused
      ? "Paused"
      : stopPhase === "stopped"
        ? "At stop"
        : stopPhase === "potential"
          ? "Possible stop"
          : "Driving";

  const statusColor = paused
    ? "text-titan-amber"
    : stopPhase === "stopped"
      ? "text-primary"
      : "text-emerald-500";

  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
            Live work session
          </p>
          <p className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
            {formatDuration(dash.elapsedSec || 0)}
          </p>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-background/50 border border-border px-3 py-3">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            Trip miles
            <StatHint label="Trip miles">
              <p>
                {milesSource === "gps"
                  ? "Auto-recorded from GPS during this work session."
                  : "Manually entered or corrected."}
              </p>
              <p>You can correct miles below if needed.</p>
            </StatHint>
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{dash.miles}</p>
        </div>
        <div className="rounded-xl bg-background/50 border border-border px-3 py-3">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <Timer className="w-3 h-3" /> Drive time
            <StatHint label="Active driving time">
              <p>Time spent moving above the stop-speed threshold.</p>
            </StatHint>
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {formatDuration(dash.driveSec || 0)}
          </p>
        </div>
        <div className="rounded-xl bg-background/50 border border-border px-3 py-3">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            Idle
            <StatHint label="Idle / stopped time">
              <p>Time spent effectively stationary (traffic grace + confirmed stops).</p>
            </StatHint>
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {formatDuration(dash.idleSec || 0)}
          </p>
        </div>
        <div className="rounded-xl bg-background/50 border border-border px-3 py-3">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Stops
            <StatHint label="Detected stops">
              <p>Automatic stops after sustained stillness, plus any you log manually.</p>
              <p>Short traffic delays are filtered when possible.</p>
            </StatHint>
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{dash.stops}</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <Gauge className="w-3 h-3" /> Avg speed
          </p>
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {dash.avgSpeedMph > 0 ? `${dash.avgSpeedMph} mph` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase">Max speed</p>
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {dash.maxSpeedMph > 0 ? `${dash.maxSpeedMph} mph` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            Avg stop
            <StatHint label="Average stop duration">
              <p>Average time of completed stops this session.</p>
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
              <p>Export full logs from Tax assistant below.</p>
            </StatHint>
          </p>
          <p className="text-sm font-semibold text-emerald-500 tabular-nums">
            ${(Number(dash.taxEstimate) || 0).toFixed(0)}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Keep eyes on the road — glance only. Pause if you need to interact. Location is collected
        only while this work session is active
        {milesSource === "gps" ? " · GPS miles on" : " · manual miles"}.
      </p>
    </div>
  );
}
