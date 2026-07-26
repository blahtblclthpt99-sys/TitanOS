import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Battery,
  ChevronDown,
  Gauge,
  MapPin,
  Navigation,
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
    cyan: "border-titan-cyan/25 text-titan-cyan",
    amber: "border-titan-amber/30 text-titan-amber",
    emerald: "border-emerald-500/30 text-emerald-400",
    rose: "border-rose-500/30 text-rose-400",
    slate: "border-border text-muted-foreground",
  };
  return (
    <div
      className={cn(
        "rounded-xl border bg-card/85 backdrop-blur-sm px-2.5 py-2 min-h-[68px] flex flex-col justify-center shadow-soft",
        accents[accent] || accents.cyan,
        className
      )}
    >
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {Icon ? <Icon className="w-3 h-3 shrink-0" aria-hidden /> : null}
        {label}
      </p>
      <p className="text-base sm:text-lg font-bold tabular-nums text-foreground leading-tight mt-0.5 truncate">
        {value}
      </p>
      {sub ? <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p> : null}
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
 * Pinned Mission Control — live ops first. Secondary telemetry is one tap away.
 */
export default function MissionControl({ userId, onOpenFolder }) {
  const [snap, setSnap] = useState(() => (userId ? safeSnapshot(userId) : null));
  const [battery, setBattery] = useState(null);
  const [systemsOpen, setSystemsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let bat = null;
    if (typeof navigator !== "undefined" && navigator.getBattery) {
      navigator
        .getBattery()
        .then((b) => {
          if (cancelled) return;
          bat = b;
          const sync = () => setBattery({ level: b.level, charging: b.charging });
          sync();
          b.addEventListener("levelchange", sync);
          b.addEventListener("chargingchange", sync);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (bat) {
        try {
          bat.removeEventListener("levelchange", () => {});
        } catch {
          /* ignore */
        }
      }
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
        Mission Control couldn't load live data. Pull to refresh or reopen Live Shift.
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
      className="sticky top-0 z-20 -mx-1 px-1 pb-3 pt-1 bg-background/95 backdrop-blur-md border-b border-border/60"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-titan-cyan">Mission Control</p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold",
                statusAccent
              )}
            >
              {snap.active ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
              ) : null}
              {snap.driverStatus}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">What you need right now</p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[40px] text-xs"
            onClick={() => onOpenFolder?.("live-shift")}
          >
            Controls
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-[40px] text-xs gap-1">
            <Link to="/comms?channel=tc-dispatch">
              <Radio className="w-3 h-3" aria-hidden /> TitanCom
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary ops — always visible, drive-readable */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
        <McCard icon={Navigation} label="Platform" value={snap.platform} accent="cyan" />
        <McCard icon={Activity} label="Stage" value={snap.stage} accent="amber" />
        <McCard icon={Wallet} label="Earn" value={snap.earningsLabel} sub={snap.profitLabel} accent="emerald" />
        <McCard icon={Timer} label="Shift" value={snap.shiftTimeLabel} accent="cyan" />
        <McCard icon={Timer} label="Trip" value={snap.tripTimerLabel} accent="cyan" />
        <McCard
          icon={Gauge}
          label="Miles"
          value={`${Number(snap.miles || 0).toFixed(1)}`}
          sub={`${Number(snap.speedMph || 0)} mph`}
          accent="slate"
        />
      </div>

      <button
        type="button"
        aria-expanded={systemsOpen}
        onClick={() => setSystemsOpen((v) => !v)}
        className="mt-2 w-full flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 min-h-[40px] text-left transition-colors duration-150 hover:bg-muted/50"
      >
        <span className="text-xs font-semibold text-muted-foreground">
          Systems · {snap.rushLabel} · {snap.gpsLabel} · {snap.netLabel}
          {snap.goalPct != null ? ` · Goal ${snap.goalPct}%` : ""}
        </span>
        <ChevronDown
          className={cn("w-4 h-4 text-muted-foreground transition-transform duration-150", systemsOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {systemsOpen ? (
        <div className="mt-1.5 grid grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2 animate-in fade-in duration-150">
          <McCard icon={Zap} label="Rush" value={snap.rushLabel} accent="amber" />
          <McCard icon={MapPin} label="GPS" value={snap.gpsLabel} accent={snap.gpsOk ? "emerald" : "rose"} />
          <McCard icon={Battery} label="Battery" value={snap.batteryLabel} accent="slate" />
          <McCard
            icon={Signal}
            label="Net"
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
          <McCard
            icon={Sparkles}
            label="Titan AI"
            value="Tip"
            sub={snap.aiTip}
            accent="cyan"
            className="col-span-3 lg:col-span-1"
          />
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2 px-0.5">
          <Sparkles className="inline w-3 h-3 text-titan-cyan mr-1 align-text-bottom" aria-hidden />
          {snap.aiTip}
        </p>
      )}
    </section>
  );
}
