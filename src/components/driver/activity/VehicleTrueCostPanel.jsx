import React, { useEffect, useMemo, useState } from "react";
import { Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  readVehicleEconomics,
  saveVehicleEconomics,
  computeTrueCostPerMile,
  MAINTENANCE_CENTS_MIN,
  MAINTENANCE_CENTS_MAX,
} from "@/lib/driverActivity/trueCostPerMile";

/**
 * Vehicle true-cost inputs — purchase, tires, 10–13¢/mi maintenance.
 */
export default function VehicleTrueCostPanel({ userId, mpg = 22, gasUsd = 3.5 }) {
  const [econ, setEcon] = useState(() => readVehicleEconomics(userId));

  useEffect(() => {
    setEcon(readVehicleEconomics(userId));
  }, [userId]);

  const live = useMemo(
    () => computeTrueCostPerMile(econ, { mpg, gasUsd }),
    [econ, mpg, gasUsd]
  );

  const set = (key, value) => setEcon((e) => ({ ...e, [key]: value }));

  const save = () => {
    if (!userId) return;
    setEcon(saveVehicleEconomics(userId, econ));
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Car className="w-4 h-4 text-titan-cyan" />
        <div>
          <p className="text-xs font-semibold">True cost per mile</p>
          <p className="text-[10px] text-muted-foreground">
            Fuel + maint ({MAINTENANCE_CENTS_MIN}–{MAINTENANCE_CENTS_MAX}¢) + tires + what you paid for
            the vehicle. This is what mainly decides worth it.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Vehicle paid $</label>
          <Input
            type="number"
            min="0"
            step="100"
            value={econ.purchase_price || ""}
            onChange={(e) => set("purchase_price", Number(e.target.value) || 0)}
            className="h-9 bg-muted border-border"
            placeholder="25000"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Life miles</label>
          <Input
            type="number"
            min="1000"
            step="1000"
            value={econ.vehicle_life_miles || ""}
            onChange={(e) => set("vehicle_life_miles", Number(e.target.value) || 150000)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Odometer</label>
          <Input
            type="number"
            min="0"
            step="100"
            value={econ.odometer || ""}
            onChange={(e) => set("odometer", Number(e.target.value) || 0)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Tire set $</label>
          <Input
            type="number"
            min="0"
            step="10"
            value={econ.tire_set_cost || ""}
            onChange={(e) => set("tire_set_cost", Number(e.target.value) || 0)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Tire life mi</label>
          <Input
            type="number"
            min="1000"
            step="1000"
            value={econ.tire_life_miles || ""}
            onChange={(e) => set("tire_life_miles", Number(e.target.value) || 40000)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Miles on tires</label>
          <Input
            type="number"
            min="0"
            step="100"
            value={econ.tire_miles_used || ""}
            onChange={(e) => set("tire_miles_used", Number(e.target.value) || 0)}
            className="h-9 bg-muted border-border"
            placeholder="0 = new"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase text-muted-foreground">
          Maintenance ¢/mi (tires+fluids basic) — {econ.maintenance_cents_per_mile}¢
        </label>
        <input
          type="range"
          min={MAINTENANCE_CENTS_MIN}
          max={MAINTENANCE_CENTS_MAX}
          step="0.5"
          value={econ.maintenance_cents_per_mile}
          onChange={(e) => set("maintenance_cents_per_mile", Number(e.target.value))}
          className="w-full mt-1"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{MAINTENANCE_CENTS_MIN}¢</span>
          <span>{MAINTENANCE_CENTS_MAX}¢</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
        <div className="rounded-lg border border-border px-2 py-1.5">
          <p className="text-[9px] uppercase text-muted-foreground">Fuel</p>
          <p className="font-bold tabular-nums">${live.fuel_per_mile.toFixed(3)}</p>
        </div>
        <div className="rounded-lg border border-border px-2 py-1.5">
          <p className="text-[9px] uppercase text-muted-foreground">Maint</p>
          <p className="font-bold tabular-nums">{live.maintenance_cents}¢</p>
        </div>
        <div className="rounded-lg border border-border px-2 py-1.5">
          <p className="text-[9px] uppercase text-muted-foreground">Tires</p>
          <p className="font-bold tabular-nums">${live.tires_per_mile.toFixed(3)}</p>
        </div>
        <div className="rounded-lg border border-border px-2 py-1.5">
          <p className="text-[9px] uppercase text-muted-foreground">Vehicle</p>
          <p className="font-bold tabular-nums">${live.depreciation_per_mile.toFixed(3)}</p>
        </div>
        <div className="rounded-lg border border-titan-cyan/40 bg-titan-cyan/10 px-2 py-1.5 sm:col-span-1 col-span-2">
          <p className="text-[9px] uppercase text-titan-cyan">All-in</p>
          <p className="font-bold tabular-nums text-titan-cyan">
            ${live.true_cost_per_mile.toFixed(3)}/mi
          </p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Tires: {live.tire_miles_used} mi used · {live.tire_miles_remaining} mi left on current set.
        Offers must beat this all-in + a small profit buffer.
      </p>
      <Button type="button" size="sm" onClick={save} disabled={!userId}>
        Save vehicle costs
      </Button>
    </div>
  );
}
