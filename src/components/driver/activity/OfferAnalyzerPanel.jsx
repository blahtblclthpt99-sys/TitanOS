import React, { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, AlertTriangle, Settings2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import VehicleTrueCostPanel from "@/components/driver/activity/VehicleTrueCostPanel";
import { formatOfferCoachCard } from "@/lib/driverActivity/driverCoach";
import {
  analyzeOffer,
  readOfferThresholds,
  saveOfferThresholds,
} from "@/lib/driverActivity/offerAnalyzer";
import { buildZipBenchmarks, getZipBenchmark } from "@/lib/driverActivity/zipBenchmarks";
import { listTripJournal } from "@/lib/driverActivity/tripJournal";

/**
 * Offer snapshot — stacks, same restaurant, parking, ZIP averages → ACCEPT / DENY.
 * Does not control Uber/DoorDash; driver follows the verdict manually.
 */
export default function OfferAnalyzerPanel({
  userId,
  mpg = 22,
  gasUsd = 3.5,
  history = [],
  defaultZip = "",
}) {
  const [thresholds, setThresholds] = useState(() => readOfferThresholds(userId));
  const [showSettings, setShowSettings] = useState(false);
  const [econTick, setEconTick] = useState(0);
  const [form, setForm] = useState({
    pay: "8.50",
    tip: "3.00",
    miles: "4.2",
    minutes: "22",
    deadhead_miles: "1",
    parking: "0",
    stack_count: "1",
    same_restaurant: false,
    zip: defaultZip || "",
  });

  useEffect(() => {
    if (!defaultZip) return;
    setForm((f) => (f.zip ? f : { ...f, zip: String(defaultZip).replace(/\D/g, "").slice(0, 5) }));
  }, [defaultZip]);

  const benchmarks = useMemo(() => {
    const journal = userId ? listTripJournal(userId) : [];
    return buildZipBenchmarks({
      journal,
      sessions: history,
      fallbackZip: defaultZip || form.zip,
    });
  }, [userId, history, defaultZip, form.zip]);

  const zipPreview = useMemo(
    () => getZipBenchmark(benchmarks, form.zip || defaultZip),
    [benchmarks, form.zip, defaultZip]
  );

  const result = useMemo(
    () =>
      analyzeOffer(
        {
          ...form,
          mpg,
          gasUsd,
        },
        thresholds,
        { benchmarks, userId }
      ),
    [form, thresholds, mpg, gasUsd, benchmarks, userId, econTick]
  );

  const coachCard = useMemo(() => formatOfferCoachCard(result), [result]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const saveThresh = () => {
    if (!userId) return;
    setThresholds(saveOfferThresholds(userId, thresholds));
    setShowSettings(false);
  };

  const verdictStyle =
    result.verdict === "ACCEPT"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
      : result.verdict === "DENY"
        ? "border-red-500/40 bg-red-500/15 text-red-300"
        : "border-titan-amber/40 bg-titan-amber/10 text-titan-amber";

  const VerdictIcon =
    result.verdict === "ACCEPT" ? CheckCircle2 : result.verdict === "DENY" ? Ban : AlertTriangle;

  const topZips = benchmarks.ranked.slice(0, 5);

  return (
    <section className="titan-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Offer decision · make more money</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Built to raise take-home — all-in $/mi (fuel + maint + tires + vehicle), stacks, parking,
            and your ZIP averages decide ACCEPT or DENY. Titan does not auto-tap other apps.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowSettings((v) => !v)}>
          <Settings2 className="w-4 h-4" />
        </Button>
      </div>

      {showSettings ? (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Your deny floors</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["minHourlyAccept", "Min $/hr"],
              ["minProfitAccept", "Min profit $"],
              ["minPerMileAccept", "Min $/mi"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] uppercase text-muted-foreground">{label}</label>
                <Input
                  type="number"
                  step="0.1"
                  value={thresholds[key]}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, [key]: Number(e.target.value) }))
                  }
                  className="h-9 bg-muted border-border"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["stackExtraMiles", "Extra mi / stack"],
              ["stackExtraMin", "Extra min / stack"],
              ["sameRestaurantExtraMiles", "Same rest. mi"],
              ["sameRestaurantExtraMin", "Same rest. min"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] uppercase text-muted-foreground">{label}</label>
                <Input
                  type="number"
                  step="0.1"
                  value={thresholds[key]}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, [key]: Number(e.target.value) }))
                  }
                  className="h-9 bg-muted border-border"
                />
              </div>
            ))}
          </div>
          <Button type="button" size="sm" onClick={saveThresh}>
            Save thresholds
          </Button>
          <VehicleTrueCostPanel
            userId={userId}
            mpg={mpg}
            gasUsd={gasUsd}
            onSaved={() => setEconTick((n) => n + 1)}
          />
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <MapPin className="w-3.5 h-3.5 text-titan-cyan" />
          ZIP average
          {zipPreview.zip ? (
            <span className="font-normal text-muted-foreground">· {zipPreview.zip}</span>
          ) : null}
          {zipPreview.source && zipPreview.source !== "none" ? (
            <span className="ml-auto text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              {zipPreview.source}
            </span>
          ) : null}
        </div>
        {zipPreview.trips > 0 ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Avg $/mi</p>
              <p className="text-base font-bold tabular-nums">
                {zipPreview.avg_per_mile != null ? `$${zipPreview.avg_per_mile}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Avg $/hr</p>
              <p className="text-base font-bold tabular-nums">
                {zipPreview.avg_per_hour != null ? `$${zipPreview.avg_per_hour}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Paid trips</p>
              <p className="text-base font-bold tabular-nums">{zipPreview.trips}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Log payouts on trips (with ZIP) to unlock area averages. Until then, base floors apply.
          </p>
        )}
        {topZips.length > 0 ? (
          <div className="pt-1 border-t border-border space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground">Your best ZIPs by $/mi</p>
            <ul className="text-xs space-y-0.5">
              {topZips.map((z) => (
                <li key={z.zip} className="flex justify-between gap-2 tabular-nums">
                  <button
                    type="button"
                    className="text-titan-cyan hover:underline text-left"
                    onClick={() => set("zip", z.zip)}
                  >
                    {z.zip}
                  </button>
                  <span className="text-muted-foreground">
                    ${z.avg_per_mile}/mi · ${z.avg_per_hour}/hr · n={z.trips}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Drop ZIP</label>
          <Input
            inputMode="numeric"
            maxLength={5}
            placeholder={defaultZip || "75201"}
            value={form.zip}
            onChange={(e) => set("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Pay $</label>
          <Input
            type="number"
            step="0.01"
            value={form.pay}
            onChange={(e) => set("pay", e.target.value)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Tip $</label>
          <Input
            type="number"
            step="0.01"
            value={form.tip}
            onChange={(e) => set("tip", e.target.value)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Miles</label>
          <Input
            type="number"
            step="0.1"
            value={form.miles}
            onChange={(e) => set("miles", e.target.value)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Minutes</label>
          <Input
            type="number"
            step="1"
            value={form.minutes}
            onChange={(e) => set("minutes", e.target.value)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Deadhead mi</label>
          <Input
            type="number"
            step="0.1"
            value={form.deadhead_miles}
            onChange={(e) => set("deadhead_miles", e.target.value)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Parking $</label>
          <Input
            type="number"
            step="0.5"
            value={form.parking}
            onChange={(e) => set("parking", e.target.value)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Orders in stack</label>
          <Input
            type="number"
            min="1"
            max="6"
            step="1"
            value={form.stack_count}
            onChange={(e) => set("stack_count", e.target.value)}
            className="h-9 bg-muted border-border"
          />
        </div>
        <div className="flex items-end sm:col-span-2">
          <label className="flex items-center gap-2 text-xs text-foreground h-9 px-1 cursor-pointer">
            <input
              type="checkbox"
              checked={form.same_restaurant}
              onChange={(e) => set("same_restaurant", e.target.checked)}
              className="rounded border-border"
            />
            Same restaurant
          </label>
        </div>
      </div>

      <div className={cn("rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3", verdictStyle)}>
        <div className="flex items-start gap-3">
          <VerdictIcon className="w-8 h-8 shrink-0" />
          <div>
            <p className="text-xl font-bold tracking-tight">{result.verdict}</p>
            <p className="text-sm font-semibold opacity-95">{coachCard.headline}</p>
            <p className="text-sm opacity-90 mt-0.5">{result.action}</p>
            <p className="text-[11px] opacity-80 tabular-nums mt-1">{coachCard.glance}</p>
          </div>
        </div>
        <div className="text-right text-xs tabular-nums space-y-0.5">
          <p>Net ${result.breakdown.netProfit.toFixed(2)}</p>
          <p>
            ${result.breakdown.hourlyNet}/hr · ${result.breakdown.perMileNet}/mi
          </p>
          <p className="opacity-80">
            Costs ${result.breakdown.costs.toFixed(2)} (fuel+maint+tires+vehicle+park)
          </p>
          {result.trueCost ? (
            <p className="opacity-90">
              Need ≥ ${Number(result.trueCost.recommended_min_gross_per_mile).toFixed(2)}/mi · offer $
              {Number(result.breakdown.perMileGross).toFixed(2)}
            </p>
          ) : null}
        </div>
      </div>

      <ul className="text-xs text-muted-foreground space-y-1">
        {result.reasons.map((r, i) => (
          <li key={i}>• {r}</li>
        ))}
      </ul>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
        {[
          {
            ok: result.gates.trueCost,
            label: result.trueCost
              ? `≥ $${Number(result.trueCost.recommended_min_gross_per_mile).toFixed(2)}/mi all-in`
              : "All-in $/mi",
          },
          { ok: result.gates.hourly, label: `≥ $${result.thresholds.minHourlyAccept}/hr` },
          { ok: result.gates.profit, label: `≥ $${result.thresholds.minProfitAccept} profit` },
          { ok: result.gates.perMile, label: `≥ $${result.thresholds.minPerMileAccept}/mi` },
          {
            ok: result.gates.zipBeat,
            label: zipPreview.trips > 0 ? "Beats ZIP avg" : "ZIP avg (n/a)",
          },
        ].map((g) => (
          <div
            key={g.label}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-center",
              g.ok ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-300"
            )}
          >
            {g.ok ? "Pass" : "Fail"} · {g.label}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">{result.formula}</p>
    </section>
  );
}
