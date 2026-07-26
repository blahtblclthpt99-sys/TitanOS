import React, { useMemo } from "react";
import { readDoorDashHistory } from "@/lib/driverActivity/doorDashWorkflow.js";
import { readShiftHistory } from "@/lib/driverHubApi";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodaysOrdersFolder({ user }) {
  const rows = useMemo(() => {
    if (!user?.id) return { dd: [], shifts: [] };
    const day = todayKey();
    const dd = (readDoorDashHistory(user.id) || []).filter(
      (d) =>
        String(d.dateLocal || d.startedAt || "").startsWith(day) ||
        String(d.startedAt || "").slice(0, 10) === day
    );
    const shifts = (readShiftHistory(user.id) || []).filter(
      (s) => String(s.started_at || "").slice(0, 10) === day
    );
    return { dd, shifts };
  }, [user?.id]);

  if (!user?.id) return <p className="text-sm text-muted-foreground">Sign in to see today's orders.</p>;

  if (!rows.dd.length && !rows.shifts.length) {
    return <p className="text-sm text-muted-foreground">No deliveries logged today yet.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.dd.map((d) => (
        <details key={d.id} className="rounded-xl border border-border bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-foreground min-h-[40px] flex items-center">
            DoorDash · {d.orderTypeLabel || "Delivery"} · ${(Number(d.payoutUsd) || 0).toFixed(2)}
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <div>Status <span className="text-foreground">{d.status}</span></div>
            <div>Miles <span className="text-foreground">{Number(d.miles || 0).toFixed(1)}</span></div>
            <div>Started <span className="text-foreground">{d.timeLocal || "—"}</span></div>
            <div>Orders <span className="text-foreground">{d.activeOrderCount || 1}</span></div>
          </dl>
        </details>
      ))}
      {rows.shifts.map((s) => (
        <details key={s.id} className="rounded-xl border border-border bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-foreground min-h-[40px] flex items-center">
            Shift · {Number(s.miles || 0).toFixed(1)} mi · {Math.round((s.elapsed_sec || 0) / 60)} min
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <div>Stops <span className="text-foreground">{s.stops || 0}</span></div>
            <div>City <span className="text-foreground">{s.city || "—"}</span></div>
          </dl>
        </details>
      ))}
    </div>
  );
}
