import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, MapPin, Package, Zap } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";
import {
  acceptNewOrder,
  arriveAtCustomer,
  arriveAtRestaurant,
  cancelDelivery,
  completeDelivery,
  createDelivery,
  DD_DEPART_HOLD_SEC,
  DD_EVENT,
  DD_ORDER_TYPES,
  DD_SCREENS,
  DD_STAGE_META,
  formatCompactDuration,
  lastKnownGps,
  liveSnapshot,
  orderTypeById,
  readActiveDelivery,
  readDoorDashHistory,
  rejectNewOrder,
  rememberGps,
  saveDeliverySnapshot,
  summarizeDoorDashPerformance,
} from "@/lib/driverActivity/doorDashWorkflow.js";

function SquareShell({ children, className, as: Comp = "div", ...rest }) {
  return (
    <Comp
      className={cn(
        "relative flex aspect-square min-h-[7.5rem] w-full flex-col items-center justify-center rounded-2xl border p-3 text-center shadow-soft transition-[transform,box-shadow] duration-200 active:scale-[0.97]",
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

function MetricTile({ label, value, accent = "emerald", sub }) {
  const accents = {
    emerald: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
    amber: "border-titan-amber/40 bg-titan-amber/15 text-titan-amber",
    cyan: "border-primary/40 bg-primary/10 text-primary",
    muted: "border-border bg-card text-foreground",
  };
  return (
    <SquareShell className={accents[accent] || accents.muted} aria-live="polite">
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums leading-none">{value}</p>
      {sub ? <p className="mt-1.5 text-[10px] opacity-70">{sub}</p> : null}
    </SquareShell>
  );
}

function ActionTile({ label, onClick, variant = "default", disabled, danger }) {
  return (
    <SquareShell
      as="button"
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic(danger ? [18, 30, 18] : 14);
        onClick?.();
      }}
      className={cn(
        "focus-ring font-bold text-sm sm:text-base leading-tight touch-manipulation select-none",
        danger
          ? "border-red-500/50 bg-red-500/15 text-red-400 hover:bg-red-500/25"
          : variant === "primary"
            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
            : variant === "warn"
              ? "border-titan-amber/50 bg-titan-amber/15 text-titan-amber hover:bg-titan-amber/25"
              : "border-border bg-card text-foreground hover:bg-muted",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {label}
    </SquareShell>
  );
}

function BlankTile() {
  return <SquareShell className="border-dashed border-border/60 bg-muted/20" aria-hidden="true" />;
}

function WideTimer({ label, value, hint }) {
  return (
    <div
      className="col-span-2 flex min-h-[7.5rem] w-full flex-col items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center shadow-soft"
      aria-live="polite"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{label}</p>
      <p className="mt-2 text-4xl sm:text-5xl font-bold tabular-nums text-primary leading-none">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StageRail({ screen }) {
  const steps = [
    DD_SCREENS.TO_RESTAURANT,
    DD_SCREENS.AT_RESTAURANT,
    DD_SCREENS.TO_CUSTOMER,
    DD_SCREENS.AT_CUSTOMER,
  ];
  if (screen === DD_SCREENS.START) return null;
  const current = DD_STAGE_META[screen]?.step || 1;
  return (
    <div className="mb-3" aria-label="Delivery stage">
      <div className="flex items-center justify-between gap-1">
        {steps.map((s, i) => {
          const meta = DD_STAGE_META[s];
          const done = meta.step < current;
          const active = meta.step === current;
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors duration-300",
                  done || active ? "bg-emerald-500" : "bg-muted"
                )}
              />
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  active ? "text-emerald-400" : "text-muted-foreground"
                )}
              >
                {i + 1}. {meta.short}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmCancel({ open, onConfirm, onDismiss }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dd-cancel-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 id="dd-cancel-title" className="text-lg font-bold text-foreground">
          Unassign / cancel order?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ends this DoorDash run and saves analytics. You can’t undo this.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="min-h-[48px] rounded-xl border border-border bg-muted font-semibold touch-manipulation"
            onClick={onDismiss}
          >
            Keep going
          </button>
          <button
            type="button"
            className="min-h-[48px] rounded-xl border border-red-500/50 bg-red-500/20 font-semibold text-red-400 touch-manipulation"
            onClick={() => {
              haptic([30, 40, 30]);
              onConfirm();
            }}
          >
            Confirm cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/** Non-blocking GPS probe — prefer last known, refresh in background. */
function resolveGpsFast() {
  const known = lastKnownGps();
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        rememberGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 4000 }
    );
  }
  return known;
}

const screenMotion = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.99 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

export default function DoorDashWorkflowPanel() {
  const { user } = useAuth();
  const userId = user?.id;
  const [tick, setTick] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const busyRef = useRef(false);
  const [busy, setBusyUi] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let id = null;
    const arm = () => {
      if (id != null) window.clearInterval(id);
      id = null;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      id = window.setInterval(() => setTick((t) => t + 1), 1000);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      document.removeEventListener("visibilitychange", arm);
      if (id != null) window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const onEv = (e) => {
      refresh();
      if (e?.detail?.departed) {
        haptic([40, 40, 80]);
        toast({
          title: "Departed restaurant",
          description: "Primary timer + GPS distance resumed automatically.",
        });
      }
    };
    window.addEventListener(DD_EVENT, onEv);
    return () => window.removeEventListener(DD_EVENT, onEv);
  }, [refresh]);

  const delivery = userId ? readActiveDelivery(userId) : null;
  const snap = useMemo(() => liveSnapshot(delivery, Date.now()), [delivery, tick]);
  const history = userId ? readDoorDashHistory(userId) : [];
  const recent = history.slice(0, 5);
  const perf = useMemo(() => summarizeDoorDashPerformance(history), [history, tick]);

  const setBusy = (v) => {
    busyRef.current = v;
    setBusyUi(v);
  };

  const commit = useCallback(
    (mutator, { toastOk } = {}) => {
      if (!userId || busyRef.current) return;
      setBusy(true);
      try {
        const cur = readActiveDelivery(userId);
        const gps = resolveGpsFast();
        const next = mutator(cur, gps);
        if (next) saveDeliverySnapshot(userId, next);
        refresh();
        if (toastOk) toastOk(next);
      } catch (err) {
        toast({
          title: "DoorDash workflow",
          description: err?.message || "Action failed",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [userId, refresh]
  );

  const startOrder = (orderTypeId) => {
    if (!userId || busyRef.current) return;
    if (!orderTypeById(orderTypeId)) return;
    setBusy(true);
    try {
      const gps = resolveGpsFast();
      if (!gps) {
        toast({
          title: "GPS warming up",
          description: "Timers started. Miles lock in as soon as GPS locks.",
        });
      }
      haptic(20);
      const next = createDelivery({ orderTypeId, gps });
      saveDeliverySnapshot(userId, next);
      refresh();
    } catch (err) {
      toast({
        title: "Could not start delivery",
        description: err?.message || "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const screen = snap.screen || DD_SCREENS.START;

  const rejectRow = (
    <>
      <ActionTile
        label="Reject New Order"
        variant="warn"
        disabled={busy}
        onClick={() =>
          commit((cur, gps) => rejectNewOrder(cur, { gps, reason: "stacked_reject" }))
        }
      />
      <ActionTile
        label="Accept New Order"
        variant="primary"
        disabled={busy}
        onClick={() => commit((cur, gps) => acceptNewOrder(cur, { gps }))}
      />
    </>
  );

  const cancelBtn = (
    <ActionTile
      label="Unassign / Cancel Order"
      danger
      disabled={busy}
      onClick={() => setConfirmCancel(true)}
    />
  );

  const departProgress =
    screen === DD_SCREENS.AT_RESTAURANT
      ? Math.min(1, Number(snap.highSpeedStreakSec || 0) / DD_DEPART_HOLD_SEC)
      : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-card/70 p-4 overflow-hidden">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-titan-amber flex items-center gap-1">
              <Zap className="w-3 h-3" aria-hidden="true" /> Contender mode
            </p>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-6 h-6 text-titan-amber" aria-hidden="true" />
              DoorDash
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {snap.stage?.label || "One-handed · GPS stages · auto-depart"}
            </p>
          </div>
          {snap.delivery ? (
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">{snap.orderTypeLabel}</p>
              <p>{snap.activeOrderCount} active</p>
            </div>
          ) : null}
        </div>

        <StageRail screen={screen} />

        {!snap.gpsAvailable && snap.delivery ? (
          <div
            className="mb-3 flex items-start gap-2 rounded-xl border border-titan-amber/40 bg-titan-amber/10 px-3 py-2 text-sm text-titan-amber"
            role="status"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>GPS signal lost — timers keep running. Distance resumes when restored.</span>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div key={screen} {...screenMotion}>
            {screen === DD_SCREENS.START ? (
              <div className="space-y-3">
                {perf.totalRuns > 0 ? (
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Finish rate
                      </p>
                      <p className="text-lg font-bold tabular-nums text-emerald-400">
                        {perf.completionRate ?? 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Avg wait
                      </p>
                      <p className="text-lg font-bold tabular-nums text-foreground">
                        {perf.avgRestaurantWaitSec != null
                          ? formatCompactDuration(perf.avgRestaurantWaitSec)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Avg miles
                      </p>
                      <p className="text-lg font-bold tabular-nums text-foreground">
                        {perf.avgMiles != null ? perf.avgMiles.toFixed(1) : "—"}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div
                  className="grid grid-cols-2 gap-3"
                  role="group"
                  aria-label="Start DoorDash order type"
                >
                  <div className="grid gap-3">
                    {DD_ORDER_TYPES.filter((t) => t.column === "left").map((t) => (
                      <ActionTile
                        key={t.id}
                        label={t.label}
                        variant="warn"
                        disabled={busy}
                        onClick={() => startOrder(t.id)}
                      />
                    ))}
                  </div>
                  <div className="grid gap-3">
                    {DD_ORDER_TYPES.filter((t) => t.column === "right").map((t) => (
                      <ActionTile
                        key={t.id}
                        label={t.label}
                        variant="primary"
                        disabled={busy}
                        onClick={() => startOrder(t.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {(screen === DD_SCREENS.TO_RESTAURANT || screen === DD_SCREENS.TO_CUSTOMER) && (
              <div
                className="grid grid-cols-2 gap-3"
                role="group"
                aria-label={snap.stage?.label}
              >
                <MetricTile label="Primary Timer" value={snap.primaryHms} accent="emerald" />
                <MetricTile
                  label="Distance Traveled"
                  value={`${Number(snap.miles || 0).toFixed(2)} mi`}
                  accent="cyan"
                  sub={snap.gpsAvailable ? "GPS live" : "GPS paused"}
                />
                {rejectRow}
                {cancelBtn}
                <ActionTile
                  label="I've Arrived"
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    commit((cur, gps) =>
                      screen === DD_SCREENS.TO_RESTAURANT
                        ? arriveAtRestaurant(cur, { gps })
                        : arriveAtCustomer(cur, { gps })
                    )
                  }
                />
              </div>
            )}

            {screen === DD_SCREENS.AT_RESTAURANT && (
              <div className="grid grid-cols-2 gap-3" role="group" aria-label="Waiting at restaurant">
                <WideTimer
                  label="Secondary Timer"
                  value={snap.secondaryHms}
                  hint={
                    departProgress > 0
                      ? `Departing… ${Math.round(departProgress * 100)}%`
                      : "Hold still — we detect when you leave"
                  }
                />
                {rejectRow}
                {cancelBtn}
                <BlankTile />
                <div className="col-span-2">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-[width] duration-300"
                      style={{ width: `${Math.round(departProgress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    Auto-advances at 15+ mph for {DD_DEPART_HOLD_SEC}s
                  </p>
                </div>
              </div>
            )}

            {screen === DD_SCREENS.AT_CUSTOMER && (
              <div className="grid grid-cols-2 gap-3" role="group" aria-label="Delivery completion">
                <WideTimer label="Delivery Completion Timer" value={snap.completionHms} />
                <BlankTile />
                <BlankTile />
                {cancelBtn}
                <ActionTile
                  label="Order Delivered"
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    commit(
                      (cur, gps) => completeDelivery(cur, { gps }),
                      {
                        toastOk: (done) => {
                          const a = done?.analytics;
                          if (!a) return;
                          haptic([20, 30, 40]);
                          toast({
                            title: "Delivery locked in",
                            description: `${a.totalMiles} mi · ${formatCompactDuration(a.totalDurationSec)} · wait ${formatCompactDuration(a.restaurantWaitSec)}`,
                          });
                        },
                      }
                    )
                  }
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {recent.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Recent DoorDash runs
          </p>
          <ul className="space-y-2">
            {recent.map((d) => {
              const a = d.analytics || {};
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {d.orderTypeLabel}{" "}
                      <span className="text-muted-foreground font-normal">· {d.status}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.dayOfWeek} · {a.totalMiles ?? d.miles ?? 0} mi ·{" "}
                      {a.totalDurationSec != null
                        ? formatCompactDuration(a.totalDurationSec)
                        : "—"}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    +{a.acceptedAddons || 0}/−{a.rejectedAddons || 0}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <ConfirmCancel
        open={confirmCancel}
        onDismiss={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          commit(
            (cur, gps) => cancelDelivery(cur, { gps }),
            {
              toastOk: () =>
                toast({
                  title: "Delivery cancelled",
                  description: "Analytics saved to history.",
                }),
            }
          );
        }}
      />
    </div>
  );
}
