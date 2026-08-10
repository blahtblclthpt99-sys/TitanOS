import React, { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, FileCheck2, ShieldCheck, Trash2, Trophy, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { readPrefs, estimateGasPriceUsd } from "@/lib/driverHubApi";
import { listTripJournal } from "@/lib/driverActivity/tripJournal.js";
import {
  DRIVER_RECORD_ACCEPT,
  clearImportedDriverRecords,
  listImportedDriverRecords,
  mergeImportedDriverRecords,
  parseDriverRecordFile,
  summarizeDriverPerformance,
} from "@/lib/driverActivity/recordImport.js";
import {
  computeTrueCostPerMile,
  readVehicleEconomics,
} from "@/lib/driverActivity/trueCostPerMile.js";
import {
  percentileLabel,
  syncDriverPerformanceSummary,
} from "@/lib/driverActivity/performanceBenchmark.js";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function ScoreRing({ score }) {
  const value = Number(score) || 0;
  const color = value >= 80 ? "text-emerald-400" : value >= 60 ? "text-titan-cyan" : value >= 40 ? "text-amber-400" : "text-rose-400";
  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-muted/45" aria-label={`Overall performance score ${score ?? 0} out of 100`}>
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="7" className="text-border" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${value * 2.7} 270`} className={color} />
      </svg>
      <div className="text-center">
        <p className={`text-3xl font-black tabular-nums ${color}`}>{score ?? "—"}</p>
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">of 100</p>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function PerformanceFolder({ user }) {
  const inputRef = useRef(null);
  const [revision, setRevision] = useState(0);
  const [reading, setReading] = useState(false);
  const [benchmark, setBenchmark] = useState(null);
  const [syncState, setSyncState] = useState("idle");

  const data = useMemo(() => {
    void revision;
    if (!user?.id) return null;
    const imported = listImportedDriverRecords(user.id);
    const native = listTripJournal(user.id).map((row) => ({ ...row, platform: row.app || "titanos", source: row.source || "titanos" }));
    const prefs = readPrefs(user.id) || {};
    const economics = readVehicleEconomics(user.id);
    const gasUsd = estimateGasPriceUsd(prefs.zip || "");
    const cost = computeTrueCostPerMile(economics, { mpg: Number(prefs.mpg) || economics.mpg, gasUsd: typeof gasUsd === "number" ? gasUsd : economics.gas_usd });
    const summary = summarizeDriverPerformance([...imported, ...native], { costPerMile: cost.true_cost_per_mile || 0.35 });
    return { imported, native, summary, costPerMile: cost.true_cost_per_mile || 0.35 };
  }, [user?.id, revision]);

  useEffect(() => {
    if (!user?.id || !data?.summary?.score || data.summary.trips < 5) return undefined;
    let cancelled = false;
    setSyncState("syncing");
    const timer = window.setTimeout(async () => {
      const result = await syncDriverPerformanceSummary(user.id, data.summary);
      if (cancelled) return;
      setBenchmark(result.benchmark || null);
      setSyncState(result.ok ? "synced" : "local");
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user?.id, data?.summary?.score, data?.summary?.trips, data?.summary?.profitPerHour, data?.summary?.profitPerMile]);

  const chooseFiles = async (event) => {
    const files = [...(event.target.files || [])].slice(0, 20);
    event.target.value = "";
    if (!files.length || !user?.id) return;
    setReading(true);
    try {
      const settled = await Promise.allSettled(files.map((file) => parseDriverRecordFile(file)));
      const parsed = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
      const failed = settled.filter((result) => result.status === "rejected");
      if (!parsed.length) throw new Error(failed[0]?.reason?.message || "No driving totals were detected. Try the platform CSV export or a text-based PDF statement.");
      const result = mergeImportedDriverRecords(user.id, parsed);
      setRevision((value) => value + 1);
      toast({
        title: `${result.added} driving record${result.added === 1 ? "" : "s"} added`,
        description: `${files.length} file${files.length === 1 ? "" : "s"} checked${result.skipped ? ` · ${result.skipped} duplicate rows skipped` : ""}${failed.length ? ` · ${failed.length} file failed` : ""}.`,
      });
    } catch (error) {
      toast({ title: "Couldn’t import records", description: error?.message || "Choose a supported statement.", variant: "destructive" });
    } finally {
      setReading(false);
    }
  };

  const clearImports = () => {
    if (!user?.id || !data?.imported.length) return;
    if (!window.confirm("Remove all imported platform records from this device? TitanOS-tracked trips will stay.")) return;
    clearImportedDriverRecords(user.id);
    setBenchmark(null);
    setRevision((value) => value + 1);
    toast({ title: "Imported records removed" });
  };

  if (!data) return <p className="text-sm text-muted-foreground">Sign in to calculate your performance.</p>;
  const { summary } = data;
  const cohortSize = Number(benchmark?.cohort_size) || 0;
  const percentile = benchmark?.score_percentile;
  const comparison = percentileLabel(percentile);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ScoreRing score={summary.score} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-titan-cyan">Overall performance</p>
            <h3 className="mt-1 text-xl font-bold text-foreground">Your profit score</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.score == null
                ? "Upload driving records or complete a TitanOS shift to calculate your score."
                : `${summary.trips} trips across ${summary.platforms.length || 1} platform${summary.platforms.length === 1 ? "" : "s"} · ${summary.dataCompleteness}% complete data.`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {comparison ? <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-bold text-emerald-400">{comparison} · {percentile}th percentile</span> : null}
              <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                {cohortSize >= 10 ? `Compared with ${cohortSize} active drivers` : `Private cohort building${cohortSize ? ` · ${cohortSize}/10` : ""}`}
              </span>
              {syncState === "local" ? <span className="text-[10px] text-muted-foreground">Comparison will sync when online</span> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Add your driving history</h3>
            <p className="mt-1 text-xs text-muted-foreground">Upload Uber, Uber Eats, DoorDash, Lyft, Spark, Instacart, Grubhub, Amazon Flex, Roadie, Shipt, or generic records.</p>
          </div>
          {data.imported.length ? (
            <Button type="button" variant="ghost" size="icon" onClick={clearImports} aria-label="Remove imported driving records" className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <input ref={inputRef} type="file" multiple accept={DRIVER_RECORD_ACCEPT} onChange={chooseFiles} className="sr-only" aria-label="Upload driving records" />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={reading} className="mt-3 w-full min-h-28 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-5 text-center transition-colors hover:bg-primary/10 disabled:opacity-60 focus-ring">
          <Upload className="mx-auto mb-2 h-6 w-6 text-titan-cyan" />
          <span className="block text-sm font-bold text-foreground">{reading ? "Reading and calculating…" : "Upload driving records"}</span>
          <span className="mt-1 block text-xs text-muted-foreground">CSV, PDF, TXT, or JSON · select up to 20 files at once</span>
        </button>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/30 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">Statements are parsed on your device. Raw trips stay private. TitanOS shares only your score and summary ratios for anonymous cohort comparisons.</p>
        </div>
        {data.imported.length ? <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><FileCheck2 className="h-4 w-4 text-emerald-400" /> {data.imported.length} imported rows stored on this device · {data.native.length} TitanOS trips included</p> : null}
      </section>

      {summary.score != null ? (
        <>
          <section aria-label="Profit metrics" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric label="Net profit" value={money.format(summary.profit)} hint={`${money.format(data.costPerMile)}/mi operating cost`} />
            <Metric label="Profit / hour" value={money.format(summary.profitPerHour)} hint={`${summary.activeHours} active hours`} />
            <Metric label="Profit / mile" value={money.format(summary.profitPerMile)} hint={`${summary.miles} total miles`} />
            <Metric label="Utilization" value={`${summary.utilization}%`} hint="Active time ÷ online time" />
          </section>

          <section className="rounded-2xl border border-border bg-card/70 p-4">
            <div className="mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-titan-cyan" /><h3 className="text-sm font-bold text-foreground">Score breakdown</h3></div>
            <div className="space-y-3">
              {[
                ["Hourly profit", summary.components.hourly, 30],
                ["Mileage profit", summary.components.mileage, 25],
                ["Utilization", summary.components.utilization, 20],
                ["Profit margin", summary.components.margin, 15],
                ["Data confidence", summary.components.confidence, 10],
              ].map(([label, value, max]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums text-foreground">{value}/{max}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-titan-cyan to-primary" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          {summary.platforms.length ? (
            <section className="rounded-2xl border border-border bg-card/70 p-4">
              <div className="mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /><h3 className="text-sm font-bold text-foreground">Your platform comparison</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="py-2 pr-3">Platform</th><th className="px-3 py-2">Trips</th><th className="px-3 py-2">Profit/hr</th><th className="px-3 py-2">Profit/mi</th><th className="pl-3 py-2 text-right">Net profit</th></tr></thead>
                  <tbody>{summary.platforms.map((row, index) => <tr key={row.platform} className="border-b border-border/60 last:border-0"><td className="py-3 pr-3 font-semibold text-foreground">{index === 0 ? "★ " : ""}{row.label}</td><td className="px-3 py-3 tabular-nums">{row.trips}</td><td className="px-3 py-3 tabular-nums">{money.format(row.profitPerHour)}</td><td className="px-3 py-3 tabular-nums">{money.format(row.profitPerMile)}</td><td className="pl-3 py-3 text-right tabular-nums">{money.format(row.profit)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
