import React, { useMemo } from "react";
import { MapPin } from "lucide-react";
import { readShiftHistory } from "@/lib/driverHubApi";
import { collectTrips } from "@/lib/driverActivity/intelligence.js";

const LAYERS = [
  { id: "revenue", label: "Highest Revenue" },
  { id: "tips", label: "Highest Tips" },
  { id: "deliveries", label: "Most Deliveries" },
  { id: "profit", label: "Highest Profit" },
  { id: "zip_best", label: "Best ZIP Codes" },
  { id: "zip_worst", label: "Worst ZIP Codes" },
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "weekends", label: "Weekends" },
  { id: "weekdays", label: "Weekdays" },
];

export default function HeatMapsFolder({ user }) {
  const zips = useMemo(() => {
    if (!user?.id) return [];
    const { sessions } = collectTrips(readShiftHistory(user.id) || []);
    const map = new Map();
    for (const t of sessions) {
      const zip = String(t.zip || t.end_zip || t.city || "Unknown").trim() || "Unknown";
      const prev = map.get(zip) || { zip, trips: 0, miles: 0 };
      prev.trips += 1;
      prev.miles += Number(t.miles || 0);
      map.set(zip, prev);
    }
    return [...map.values()].sort((a, b) => b.trips - a.trips).slice(0, 24);
  }, [user?.id]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Interactive map layers are scaffolded for zoom/filter. ZIP density from your history appears below.
      </p>
      <div className="flex flex-wrap gap-2">
        {LAYERS.map((l) => (
          <span
            key={l.id}
            className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-300"
          >
            {l.label}
          </span>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950/40 p-4 min-h-[180px]">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <MapPin className="w-4 h-4 text-sky-400" />
          Delivery density
        </div>
        {zips.length === 0 ? (
          <p className="text-sm text-muted-foreground">Log trips to populate heat layers.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {zips.map((z) => (
              <li key={z.zip} className="rounded-xl bg-white/5 border border-white/10 px-2.5 py-2 text-xs">
                <p className="font-semibold text-foreground truncate">{z.zip}</p>
                <p className="text-muted-foreground">
                  {z.trips} trips · {z.miles.toFixed(1)} mi
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
