import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, MapPin, Package } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  acceptNewOrder,
  arriveAtCustomer,
  arriveAtRestaurant,
  cancelDelivery,
  completeDelivery,
  createDelivery,
  DD_EVENT,
  DD_ORDER_TYPES,
  DD_SCREENS,
  liveSnapshot,
  orderTypeById,
  readActiveDelivery,
  readDoorDashHistory,
  rejectNewOrder,
  saveDeliverySnapshot,
} from "@/lib/driverActivity/doorDashWorkflow.js";

function SquareShell({ children, className, as: Comp = "div", ...rest }) {
  return (
    <Comp
      className={cn(
        "relative flex aspect-square min-h-[7.5rem] w-full flex-col items-center justify-center rounded-2xl border p-3 text-center shadow-soft transition-transform duration-200 active:scale-[0.98]",
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

function MetricTile({ label, value, accent = "emerald" }) {
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
    </SquareShell>
  );
}

function ActionTile({ label, onClick, variant = "default", disabled, danger }) {
  return (
    <SquareShell
      as="button"
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "focus-ring font-bold text-sm sm:text-base leading-tight",
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

function WideTimer({ label, value }) {
  return (
    <div
      className="col-span-2 flex min-h-[7.5rem] w-full flex-col items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center shadow-soft"
      aria-live="polite"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{label}</p>
      <p className="mt-2 text-4xl sm:text-5xl font-bold tabular-nums text-primary leading-none">
        {value}
      </p>
    </div>
  );
}

function ConfirmCancel({ open, onConfirm, onDismiss }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dd-cancel-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 id="dd-cancel-title" className="text-lg font-bold text-foreground">
          Unassign / cancel order?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This ends the current DoorDash delivery and saves analytics. You can’t undo this.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="min-h-[48px] rounded-xl border border-border bg-muted font-semibold"
            onClick={onDismiss}
          >
            Keep going
          </button>
          <button
            type="button"
            className="min-h-[48px] rounded-xl border border-red-500/50 bg-red-500/20 font-semibold text-red-400"
            onClick={onConfirm}
          >
            Confirm cancel
          </button>
        </div>
      </div>
    </div>
  );
}

async function probeGps() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );
  });
}

export default function DoorDashWorkflowPanel() {
  const { user } = useAuth();
  const userId = user?.id;
  const [tick, setTick] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onEv = () => refresh();
    window.addEventListener(DD_EVENT, onEv);
    return () => window.removeEventListener(DD_EVENT, onEv);
  }, [refresh]);

  const delivery = userId ? readActiveDelivery(userId) : null;
  const snap = useMemo(() => liveSnapshot(delivery, Date.now()), [delivery, tick]);
  const history = userId ? readDoorDashHistory(userId).slice(0, 5) : [];

  const commit = useCallback(
    async (mutator) => {
      if (!userId || busy) return;
      setBusy(true);
      try {
        const cur = readActiveDelivery(userId);
        const gps = await probeGps();
        const next = mutator(cur, gps);
        if (next) saveDeliverySnapshot(userId, next);
        refresh();
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
    [userId, busy, refresh]
  );

  const startOrderFixed = async (orderTypeId) => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const gps = await probeGps();
      if (!gps) {
        toast({
          title: "GPS unavailable",
          description: "Timers will run. Distance resumes when GPS is restored.",
        });
      }
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card/80 p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-titan-amber">
              Smart delivery
            </p>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-6 h-6 text-titan-amber" aria-hidden="true" />
              DoorDash
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Large taps · GPS stages · auto-depart at 15+ mph.
            </p>
          </div>
          {snap.delivery ? (
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">{snap.orderTypeLabel}</p>
              <p>{snap.activeOrderCount} active</p>
            </div>
          ) : null}
        </div>

        {!snap.gpsAvailable && snap.delivery ? (
          <div
            className="mb-3 flex items-start gap-2 rounded-xl border border-titan-amber/40 bg-titan-amber/10 px-3 py-2 text-sm text-titan-amber"
            role="status"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>GPS signal lost — timers keep running. Distance pauses until restored.</span>
          </div>
        ) : null}

        {/* SCREEN 1 */}
        {screen === DD_SCREENS.START ? (
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Start DoorDash order type">
            <div className="grid gap-3">
              {DD_ORDER_TYPES.filter((t) => t.column === "left").map((t) => (
                <ActionTile
                  key={t.id}
                  label={t.label}
                  variant="warn"
                  disabled={busy}
                  onClick={() => startOrderFixed(t.id)}
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
                  onClick={() => startOrderFixed(t.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* SCREEN 2 & 4 — driving */}
        {(screen === DD_SCREENS.TO_RESTAURANT || screen === DD_SCREENS.TO_CUSTOMER) && (
          <div
            className="grid grid-cols-2 gap-3"
            role="group"
            aria-label={
              screen === DD_SCREENS.TO_RESTAURANT
                ? "Driving to restaurant"
                : "Driving to customer"
            }
          >
            <MetricTile label="Primary Timer" value={snap.primaryHms} accent="emerald" />
            <MetricTile
              label="Distance Traveled"
              value={`${Number(snap.miles || 0).toFixed(2)} Miles`}
              accent="cyan"
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

        {/* SCREEN 3 — waiting at restaurant */}
        {screen === DD_SCREENS.AT_RESTAURANT && (
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Waiting at restaurant">
            <WideTimer label="Secondary Timer" value={snap.secondaryHms} />
            {rejectRow}
            {cancelBtn}
            <BlankTile />
            <p className="col-span-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              Auto-advances when you drive 15+ mph for 10 seconds
            </p>
          </div>
        )}

        {/* SCREEN 5 — delivery complete */}
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
                commit((cur, gps) => {
                  const done = completeDelivery(cur, { gps });
                  const a = done?.analytics;
                  if (a) {
                    toast({
                      title: "Delivery saved",
                      description: `${a.totalMiles} mi · ${a.totalDurationSec}s · wait ${a.restaurantWaitSec}s`,
                    });
                  }
                  return done;
                })
              }
            />
          </div>
        )}
      </div>

      {history.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Recent DoorDash runs
          </p>
          <ul className="space-y-2">
            {history.map((d) => {
              const a = d.analytics || {};
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {d.orderTypeLabel}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {d.status}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.dayOfWeek} · {a.totalMiles ?? d.miles ?? 0} mi ·{" "}
                      {a.totalDurationSec != null ? `${a.totalDurationSec}s` : "—"}
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
          commit((cur, gps) => {
            const done = cancelDelivery(cur, { gps });
            toast({ title: "Delivery cancelled", description: "Analytics saved to history." });
            return done;
          });
        }}
      />
    </div>
  );
}
