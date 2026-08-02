import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  Download,
  Fuel,
  Wrench,
  Receipt,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import { toast } from "@/components/ui/use-toast";
import { formatDuration, readShiftHistory, readPrefs } from "@/lib/driverHubApi";
import { downloadTextFile } from "@/lib/driverActivity/export";
import {
  downloadExcelFile,
  buildDailyTripReportExcel,
  buildLogbookExcel,
} from "@/lib/driverActivity/excelExport";
import {
  listTripJournal,
  summarizeDayTrips,
  buildDailyTripReportCsv,
  syncSessionLegsToJournal,
  liveSessionTimerRow,
} from "@/lib/driverActivity/tripJournal";
import { buildZipBenchmarks } from "@/lib/driverActivity/zipBenchmarks";
import {
  TRIP_PURPOSES,
  EXPENSE_CATEGORIES,
  enrichTripsWithClassification,
  setTripClassification,
  logbookTotals,
  listFuelLogs,
  addFuelLog,
  deleteFuelLog,
  fuelEconomyStats,
  listVehicleExpenses,
  addVehicleExpense,
  deleteVehicleExpense,
  listServiceReminders,
  addServiceReminder,
  toggleServiceReminder,
  buildLogbookCsv,
  readTagRules,
  saveTagRules,
} from "@/lib/driverActivity/vehicleLogbook";
import { cn } from "@/lib/utils";

/**
 * Titan Vehicle Logbook — classify miles, fuel, expenses, reminders.
 * Original TitanOS design; not affiliated with any third-party mileage app.
 */
export default function VehicleLogbookPanel({ userId, history = [], liveSession = null, stops = [] }) {
  const [tick, setTick] = useState(0);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fuelForm, setFuelForm] = useState({
    gallons: "",
    total_cost: "",
    odometer: "",
    station: "",
  });
  const [expForm, setExpForm] = useState({
    category: "maintenance",
    amount: "",
    vendor: "",
  });
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDue, setReminderDue] = useState("");

  // Backfill journal from saved sessions so older days still export trip-by-trip
  useEffect(() => {
    if (!userId) return;
    const hist = history?.length ? history : readShiftHistory(userId);
    for (const s of hist || []) {
      try {
        syncSessionLegsToJournal(userId, s, s.stops_detail || []);
      } catch {
        /* ignore */
      }
    }
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const dayTrips = useMemo(() => {
    if (!userId) return [];
    return listTripJournal(userId, { date: reportDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reportDate, tick]);

  const liveRow = useMemo(() => {
    if (!liveSession?.active) return null;
    const liveDate = (liveSession.started_at || "").slice(0, 10);
    if (liveDate && liveDate !== reportDate) return null;
    return liveSessionTimerRow(liveSession, stops);
  }, [liveSession, stops, reportDate]);

  const reportTrips = useMemo(() => {
    const rows = [...dayTrips];
    if (liveRow && !rows.some((r) => r.id === liveRow.id)) rows.push(liveRow);
    return rows;
  }, [dayTrips, liveRow]);

  const daySummary = useMemo(() => summarizeDayTrips(reportTrips), [reportTrips]);

  const enriched = useMemo(() => {
    if (!userId) return [];
    return enrichTripsWithClassification(userId, history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, history, tick]);

  const totals = useMemo(() => logbookTotals(enriched), [enriched]);
  const fuels = userId ? listFuelLogs(userId) : [];
  const expenses = userId ? listVehicleExpenses(userId) : [];
  const reminders = userId ? listServiceReminders(userId) : [];
  const fuelStats = useMemo(() => fuelEconomyStats(fuels), [fuels, tick]);
  const rules = userId ? readTagRules(userId) : [];

  const classify = (tripId, purpose) => {
    if (!userId) return;
    setTripClassification(userId, tripId, { purpose, auto_tagged: false });
    setTick((t) => t + 1);
    toast({ title: `Tagged as ${TRIP_PURPOSES.find((p) => p.id === purpose)?.label || purpose}` });
  };

  const exportCsv = () => {
    const csv = buildLogbookCsv(enriched);
    downloadTextFile(`titanos-mileage-logbook-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast({ title: "Logbook CSV downloaded" });
  };

  const exportLogbookExcel = () => {
    const book = buildLogbookExcel(enriched);
    downloadExcelFile(book.filename, book.sheets);
    toast({ title: "Logbook Excel downloaded" });
  };

  const zipBenchmarks = useMemo(() => {
    if (!userId) return null;
    const prefs = readPrefs(userId);
    return buildZipBenchmarks({
      journal: listTripJournal(userId),
      sessions: history.length ? history : readShiftHistory(userId),
      fallbackZip: prefs.zip || "",
    });
  }, [userId, history, tick]);

  const exportDailyReport = () => {
    const book = buildDailyTripReportExcel(dayTrips, {
      date: reportDate,
      liveRow,
      zipBenchmarks,
    });
    downloadExcelFile(book.filename, book.sheets);
    toast({
      title: "Excel spreadsheet ready",
      description: `${daySummary.trips} trips · drive ${daySummary.drive_hms} · idle ${daySummary.idle_hms}`,
    });
  };

  const exportDailyCsv = () => {
    const csv = buildDailyTripReportCsv(dayTrips, { date: reportDate, liveRow });
    downloadTextFile(`titanos-daily-trips-${reportDate}.csv`, csv);
    toast({ title: "Daily CSV downloaded" });
  };

  const addFuel = (e) => {
    e.preventDefault();
    if (!userId) return;
    addFuelLog(userId, fuelForm);
    setFuelForm({ gallons: "", total_cost: "", odometer: "", station: "" });
    setTick((t) => t + 1);
    toast({ title: "Fuel fill-up saved" });
  };

  const addExpense = (e) => {
    e.preventDefault();
    if (!userId || !expForm.amount) return;
    addVehicleExpense(userId, expForm);
    setExpForm({ category: "maintenance", amount: "", vendor: "" });
    setTick((t) => t + 1);
    toast({ title: "Expense saved" });
  };

  const addReminder = (e) => {
    e.preventDefault();
    if (!userId || !reminderTitle.trim()) return;
    addServiceReminder(userId, { title: reminderTitle, due_date: reminderDue || null });
    setReminderTitle("");
    setReminderDue("");
    setTick((t) => t + 1);
    toast({ title: "Reminder added" });
  };

  const toggleWorkRule = () => {
    if (!userId || !rules[0]) return;
    const next = rules.map((r, i) => (i === 0 ? { ...r, enabled: !r.enabled } : r));
    saveTagRules(userId, next);
    setTick((t) => t + 1);
  };

  if (!userId) {
    return <p className="text-sm text-muted-foreground">Sign in to use the vehicle logbook.</p>;
  }

  return (
    <div className="space-y-4">
      <FeatureHonestyBanner tone="info">
        <strong>Titan Vehicle Logbook</strong> keeps drive timer and idle timer separate on every
        trip. Download the Excel spreadsheet for your day. Not tax advice — and not affiliated with
        any other mileage brand.
      </FeatureHonestyBanner>

      <section className="titan-surface p-4 space-y-3 border border-titan-cyan/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">End-of-day trip report</h2>
          <Input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="h-9 w-[160px] bg-muted border-border"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="rounded-xl border border-border bg-card/60 px-3 py-2.5">
            <p className="text-[10px] uppercase text-muted-foreground">Trips</p>
            <p className="text-lg font-bold tabular-nums">{daySummary.completed_trips}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
            <p className="text-[10px] uppercase text-emerald-400">Drive</p>
            <p className="text-lg font-bold tabular-nums">{daySummary.drive_hms}</p>
          </div>
          <div className="rounded-xl border border-titan-amber/30 bg-titan-amber/10 px-3 py-2.5">
            <p className="text-[10px] uppercase text-titan-amber">Idle / stop</p>
            <p className="text-lg font-bold tabular-nums">{daySummary.idle_hms}</p>
          </div>
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5">
            <p className="text-[10px] uppercase text-sky-400">Between orders</p>
            <p className="text-lg font-bold tabular-nums">{daySummary.between_orders_hms}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/60 px-3 py-2.5">
            <p className="text-[10px] uppercase text-muted-foreground">Pause</p>
            <p className="text-lg font-bold tabular-nums">{daySummary.pause_hms}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/60 px-3 py-2.5">
            <p className="text-[10px] uppercase text-muted-foreground">Miles</p>
            <p className="text-lg font-bold tabular-nums">{daySummary.miles}</p>
          </div>
        </div>
        {liveRow ? (
          <p className="text-xs text-emerald-400">
            LIVE timers included: drive {liveRow.drive_hms} · idle {liveRow.idle_hms} · pause{" "}
            {liveRow.pause_hms} · elapsed {liveRow.elapsed_hms}
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" className="w-full gap-2" onClick={exportDailyReport}>
            <Download className="w-4 h-4" /> Download Excel spreadsheet for {reportDate}
          </Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto gap-2" onClick={exportDailyCsv}>
            CSV
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Excel opens with sheets for Trips (every timer), Daily Totals, Timer Legend, and ZIP
          Averages. Seconds columns stay numeric for formulas. CSV still available if you prefer.
        </p>
        {reportTrips.length > 0 ? (
          <ul className="max-h-56 overflow-y-auto divide-y divide-border text-sm">
            {reportTrips.map((t) => (
              <li key={t.id} className="py-2 space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">
                    {t.status === "running" ? "LIVE" : `#${t.trip_number}`} · {t.label || "Trip"} ·{" "}
                    {t.miles} mi
                  </span>
                </div>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  Drive {t.drive_hms} · Idle {t.idle_hms} · Between {t.between_orders_hms} · Active{" "}
                  {t.active_hms}
                  {t.pause_sec > 0 ? ` · Pause ${t.pause_hms}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No trips for this date yet. Drive with Auto GPS — each stop saves its own trip timers.
          </p>
        )}
      </section>

      <section className="titan-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-titan-cyan" /> Mileage logbook
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="gap-1" onClick={exportLogbookExcel}>
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={exportCsv}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Trips", value: totals.trips },
            { label: "Work miles", value: totals.work_miles },
            { label: "Personal miles", value: totals.personal_miles },
            { label: "Deductible est.", value: `$${totals.deductible_usd.toFixed(0)}` },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card/60 px-3 py-2.5">
              <p className="text-[10px] uppercase text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
        {totals.needs_review > 0 ? (
          <p className="text-xs text-titan-amber">{totals.needs_review} trip(s) need a purpose tag.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Auto-tag weekday 7am–7pm as Work:</span>
          <Button type="button" size="sm" variant="outline" onClick={toggleWorkRule}>
            {rules[0]?.enabled ? "On" : "Off"}
          </Button>
        </div>
      </section>

      <section className="titan-surface p-4 space-y-2">
        <h3 className="text-sm font-semibold">Trips — tap to classify</h3>
        {enriched.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No trips yet. Run a work session, then classify each drive as Work or Personal here.
          </p>
        ) : (
          <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {enriched.slice(0, 40).map((t) => (
              <li key={t.id} className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/driver/trip/${encodeURIComponent(t.id)}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {(t.started_at || "").slice(0, 10)} · {Number(t.miles) || 0} mi
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(Number(t.drive_sec) || Number(t.elapsed_sec) || 0)} drive
                      {t.classification?.auto_tagged ? " · auto-tagged" : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0",
                      t.deductible
                        ? "border-emerald-500/40 text-emerald-400"
                        : t.purpose === "unclassified"
                          ? "border-titan-amber/40 text-titan-amber"
                          : "border-border text-muted-foreground"
                    )}
                  >
                    {t.purpose_label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TRIP_PURPOSES.filter((p) => p.id !== "unclassified").map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => classify(t.id, p.id)}
                      className={cn(
                        "text-[11px] rounded-lg border px-2.5 py-1.5 min-h-[36px]",
                        t.purpose === p.id
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.purpose === p.id ? <Check className="w-3 h-3 inline mr-1" /> : null}
                      {p.short}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="titan-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Fuel className="w-4 h-4 text-titan-cyan" /> Fuel log
          </h3>
          <p className="text-xs text-muted-foreground">
            {fuelStats.fillups} fill-ups · ${fuelStats.spent.toFixed(2)} spent
            {fuelStats.mpg != null ? ` · ~${fuelStats.mpg} MPG` : " · add odometer on 2+ fill-ups for MPG"}
          </p>
          <form onSubmit={addFuel} className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Gallons"
              type="number"
              step="0.01"
              value={fuelForm.gallons}
              onChange={(e) => setFuelForm((f) => ({ ...f, gallons: e.target.value }))}
              className="h-9 bg-muted border-border"
            />
            <Input
              placeholder="Total $"
              type="number"
              step="0.01"
              value={fuelForm.total_cost}
              onChange={(e) => setFuelForm((f) => ({ ...f, total_cost: e.target.value }))}
              className="h-9 bg-muted border-border"
            />
            <Input
              placeholder="Odometer"
              type="number"
              value={fuelForm.odometer}
              onChange={(e) => setFuelForm((f) => ({ ...f, odometer: e.target.value }))}
              className="h-9 bg-muted border-border"
            />
            <Input
              placeholder="Station"
              value={fuelForm.station}
              onChange={(e) => setFuelForm((f) => ({ ...f, station: e.target.value }))}
              className="h-9 bg-muted border-border"
            />
            <Button type="submit" size="sm" className="col-span-2 gap-1">
              <Plus className="w-3.5 h-3.5" /> Add fill-up
            </Button>
          </form>
          <ul className="space-y-1 max-h-36 overflow-y-auto text-sm">
            {fuels.slice(0, 8).map((f) => (
              <li key={f.id} className="flex justify-between gap-2 text-xs border-b border-border py-1.5">
                <span>
                  {f.date} · {f.gallons} gal · ${Number(f.total_cost).toFixed(2)}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    deleteFuelLog(userId, f.id);
                    setTick((t) => t + 1);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="titan-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-titan-cyan" /> Vehicle expenses
          </h3>
          <form onSubmit={addExpense} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={expForm.category}
                onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}
                className="h-9 rounded-md bg-muted border border-border text-sm px-2"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Amount $"
                type="number"
                step="0.01"
                value={expForm.amount}
                onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-9 bg-muted border-border"
              />
            </div>
            <Input
              placeholder="Vendor / note"
              value={expForm.vendor}
              onChange={(e) => setExpForm((f) => ({ ...f, vendor: e.target.value }))}
              className="h-9 bg-muted border-border"
            />
            <Button type="submit" size="sm" className="w-full gap-1">
              <Plus className="w-3.5 h-3.5" /> Add expense
            </Button>
          </form>
          <ul className="space-y-1 max-h-36 overflow-y-auto text-xs">
            {expenses.slice(0, 8).map((x) => (
              <li key={x.id} className="flex justify-between gap-2 border-b border-border py-1.5">
                <span>
                  {x.date} · {x.category} · ${Number(x.amount).toFixed(2)}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    deleteVehicleExpense(userId, x.id);
                    setTick((t) => t + 1);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="titan-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="w-4 h-4 text-titan-cyan" /> Service reminders
        </h3>
        <form onSubmit={addReminder} className="flex flex-wrap gap-2">
          <Input
            placeholder="Oil change, tires…"
            value={reminderTitle}
            onChange={(e) => setReminderTitle(e.target.value)}
            className="h-9 bg-muted border-border flex-1 min-w-[140px]"
          />
          <Input
            type="date"
            value={reminderDue}
            onChange={(e) => setReminderDue(e.target.value)}
            className="h-9 bg-muted border-border w-[150px]"
          />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
        <ul className="space-y-1">
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders yet.</p>
          ) : (
            reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border">
                <button
                  type="button"
                  className={cn("text-left", r.done && "line-through text-muted-foreground")}
                  onClick={() => {
                    toggleServiceReminder(userId, r.id);
                    setTick((t) => t + 1);
                  }}
                >
                  {r.title}
                  {r.due_date ? ` · due ${r.due_date}` : ""}
                </button>
                <span className="text-[10px] uppercase text-muted-foreground">
                  {r.done ? "Done" : "Open"}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
