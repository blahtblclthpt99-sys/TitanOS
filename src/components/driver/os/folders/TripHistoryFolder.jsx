import React, { useMemo, useState } from "react";
import { readShiftHistory } from "@/lib/driverHubApi";
import { readDoorDashHistory } from "@/lib/driverActivity/doorDashWorkflow.js";
import VirtualList, { shouldVirtualize } from "@/components/shared/VirtualList";

export default function TripHistoryFolder({ user, refreshTick = 0 }) {
  const [q, setQ] = useState("");
  const history = useMemo(() => {
    void refreshTick;
    if (!user?.id) return [];
    const shifts = (readShiftHistory(user.id) || []).map((s) => ({
      kind: "shift",
      id: s.id,
      when: s.started_at,
      label: `Shift · ${Number(s.miles || 0).toFixed(1)} mi`,
      meta: s.city || "",
    }));
    const dd = (readDoorDashHistory(user.id) || []).map((d) => ({
      kind: "doordash",
      id: d.id,
      when: d.startedAt,
      label: `DoorDash · ${d.orderTypeLabel || "Order"}`,
      meta: d.dateLocal || "",
    }));
    return [...shifts, ...dd].sort((a, b) => String(b.when || "").localeCompare(String(a.when || "")));
  }, [user?.id, refreshTick]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return history;
    return history.filter((r) => `${r.label} ${r.meta} ${r.kind}`.toLowerCase().includes(needle));
  }, [history, q]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const row of filtered) {
      const d = row.when ? new Date(row.when) : new Date();
      const year = String(Number.isFinite(d.getTime()) ? d.getFullYear() : new Date().getFullYear());
      const month = Number.isFinite(d.getTime())
        ? d.toLocaleString(undefined, { month: "long" })
        : "Unknown";
      const key = `${year}/${month}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to browse trip history.</p>;
  }

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by platform, city, date…"
        className="w-full h-11 rounded-lg border border-border bg-muted px-3 text-sm focus-ring"
        autoComplete="off"
      />
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trip history yet.</p>
      ) : (
        groups.map(([folder, rows]) => {
          const list = rows.slice(0, 500);
          return (
            <details key={folder} className="rounded-xl border border-border overflow-hidden" open>
              <summary className="px-3 py-2.5 bg-muted/40 text-sm font-semibold cursor-pointer min-h-[44px]">
                {folder} · {rows.length}
              </summary>
              {shouldVirtualize(list.length) ? (
                <div className="max-h-80 overflow-auto">
                  <VirtualList
                    items={list}
                    estimateSize={56}
                    gap={0}
                    renderItem={(r) => (
                      <div className="px-3 py-2.5 border-b border-border text-sm">
                        <p className="font-medium text-foreground">{r.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.when ? new Date(r.when).toLocaleString() : "—"}
                          {r.meta ? ` · ${r.meta}` : ""}
                        </p>
                      </div>
                    )}
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((r) => (
                    <li key={`${r.kind}-${r.id}`} className="px-3 py-2 text-sm">
                      <p className="font-medium text-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.when ? new Date(r.when).toLocaleString() : "—"}
                        {r.meta ? ` · ${r.meta}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          );
        })
      )}
    </div>
  );
}
