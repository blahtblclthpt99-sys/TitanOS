import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Battery,
  ChevronDown,
  Gauge,
  MapPin,
  Radio,
  Signal,
  Sparkles,
  Timer,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DRIVER_SESSION_EVENT } from "@/components/driver/activity/DriverSessionKeepAlive";
import { buildMissionSnapshot } from "@/lib/driverOs/missionSnapshot.js";

function McCard({ icon: Icon, label, value, sub, accent = "cyan", className }) {
  const accents = {
    cyan: "border-titan-cyan/30",
    amber: "border-titan-amber/35",
    emerald: "border-emerald-500/35",
    rose: "border-rose-500/35",
    slate: "border-border",
  };
  return (
    <div
      className={cn(
        "rounded-xl border bg-card/90 px-3 py-2.5 min-h-[72px] flex flex-col justify-center",
        accents[accent] || accents.cyan,
        className
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </p>
      <p className="text-lg font-semibold tabular-nums text-foreground leading-snug mt-1 truncate">
        {value}
      </p>
      {sub ? <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p> : null}
    </div>
  );
}

function safeSnapshot(userId, extra) {
  try {
    return buildMissionSnapshot(userId, extra);
  } catch (err) {
    console.error("[MissionControl]", err);
    return null;
  }
}

/**
 * Compact Mission Control — primary ops only; systems tucked away.
 */
export default function MissionControl({ userId, onOpenFolder }) {
  const [snap, setSnap] = useState(() => (userId ? safeSnapshot(userId) : null));
  const [battery, setBattery] = useState(null);
  const [systemsOpen, setSystemsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== "undefined" && navigator.getBattery) {
      navigator
        .getBattery()
        .then((b) => {
          if (cancelled) return;
          const sync = () => setBattery({ level: b.level, charging: b.charging });
          sync();
          b.addEventListener("levelchange", sync);
          b.addEventListener("chargingchange", sync);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setSnap(null);
      return undefined;
    }
    const refresh = () => setSnap(safeSnapshot(userId, { battery }));
    refresh();
    window.addEventListener(DRIVER_SESSION_EVENT, refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("focus", refresh);
    const id = window.setInterval(refresh, 1000);
    return () => {
      window.removeEventListener(DRIVER_SESSION_EVENT, refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(id);
    };
  }, [userId, battery]);

  if (!userId) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        Sign in to open Mission Control.
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
        Mission Control couldn't load. Pull to refresh.
      </div>
    );
  }

  const statusAccent = snap.active
    ? snap.paused
      ? "text-titan-amber"
      : "text-emerald-400"
    : "text-muted-foreground";

  return (
    <section
      aria-label="Mission Control"
      className="sticky top-0 z-20 pb-3 pt-0.5 bg-background/95 backdrop-blur-md border-b border-border/50"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground shrink-0">Live</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium truncate",
              statusAccent
            )}
          >
            {snap.active ? (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
            ) : null}
            {snap.driverStatus}
            {snap.platform && snap.platform !== "Idle" ? ` · ${snap.platform}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-3 text-xs"
            onClick={() => onOpenFolder?.("live-shift")}
          >
            Controls
          </Button>
          <Button asChild size="icon" variant="ghost" className="h-9 w-9" aria-label="TitanCom">
            <Link to="/comms?channel=tc-dispatch">
              <Radio className="w-4 h-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {/* 2×2 on phone — room to breathe; 4 across on tablet+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <McCard icon={Activity} label="Stage" value={snap.stage} accent="amber" />
        <McCard
          icon={Wallet}
          label="Earnings"
          value={snap.earningsLabel}
          sub={snap.profitLabel}
          accent="emerald"
        />
        <McCard icon={Timer} label="Shift" value={snap.shiftTimeLabel} accent="cyan" />
        <McCard
          icon={Gauge}
          label="Miles"
          value={`${Number(snap.miles || 0).toFixed(1)} mi`}
          sub={`${Number(snap.speedMph || 0)} mph · trip ${snap.tripTimerLabel}`}
          accent="slate"
        />
      </div>

      <button
        type="button"
        aria-expanded={systemsOpen}
        onClick={() => setSystemsOpen((v) => !v)}
        className="mt-2 w-full flex items-center justify-between gap-2 rounded-xl bg-muted/25 px-3 py-2 min-h-[40px] text-left hover:bg-muted/40 transition-colors duration-150"
      >
        <span className="text-xs text-muted-foreground truncate">
          {snap.rushLabel} · {snap.gpsLabel} · {snap.netLabel}
          {snap.goalPct != null ? ` · ${snap.goalPct}% goal` : ""}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150",
            systemsOpen && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {systemsOpen ? (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
          <McCard icon={Zap} label="Rush" value={snap.rushLabel} accent="amber" />
          <McCard icon={MapPin} label="GPS" value={snap.gpsLabel} accent={snap.gpsOk ? "emerald" : "rose"} />
          <McCard icon={Battery} label="Battery" value={snap.batteryLabel} accent="slate" />
          <McCard
            icon={Signal}
            label="Network"
            value={snap.netLabel}
            accent={snap.net?.online ? "emerald" : "rose"}
          />
          <McCard
            icon={Activity}
            label="Goal"
            value={snap.goalPct != null ? `${snap.goalPct}%` : "—"}
            sub={snap.goalLabel}
            accent="cyan"
          />
          <McCard icon={Timer} label="Trip timer" value={snap.tripTimerLabel} accent="cyan" />
          <McCard
            icon={Sparkles}
            label="Titan AI"
            value="Recommendation"
            sub={snap.aiTip}
            accent="cyan"
            className="col-span-2 md:col-span-3"
          />
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
          <Sparkles className="inline w-3 h-3 text-titan-cyan mr-1 align-text-bottom" aria-hidden />
          {snap.aiTip}
        </p>
      )}
    </section>
  );
}
