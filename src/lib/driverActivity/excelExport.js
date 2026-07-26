/**
 * Driver Excel reports — domain sheets built on the shared SpreadsheetML exporter.
 * Do not re-implement XML builders here; extend `@/lib/export/excel` instead.
 */
import { buildSpreadsheetMl, downloadExcelFile } from "@/lib/export/excel";
import { withAllTimers, summarizeDayTrips } from "./tripJournal.js";
import { IRS_MILEAGE_RATE_USD } from "../driverHubMath.js";

export { buildSpreadsheetMl, downloadExcelFile };

const TRIP_HEADERS = [
  "date",
  "trip_number",
  "status",
  "started_at",
  "ended_at",
  "drive_timer_hms",
  "idle_timer_hms",
  "between_orders_timer_hms",
  "pause_timer_hms",
  "active_timer_hms",
  "cycle_timer_hms",
  "session_elapsed_timer_hms",
  "drive_sec",
  "idle_sec",
  "between_orders_sec",
  "pause_sec",
  "active_sec",
  "cycle_sec",
  "elapsed_sec",
  "miles",
  "earnings",
  "tips",
  "zip",
  "label",
  "platform",
  "pickup_lat",
  "pickup_lng",
  "dropoff_lat",
  "dropoff_lng",
  "notes",
  "session_id",
  "trip_id",
];

const TIMER_LEGEND = [
  ["Timer", "Meaning"],
  ["drive_timer", "Moving / en-route time only"],
  ["idle_timer", "Stopped at customer or restaurant (stop dwell)"],
  ["between_orders_timer", "Gap waiting after previous drop before this trip started"],
  ["pause_timer", "Manual pause on the work session"],
  ["active_timer", "drive + idle for this trip"],
  ["cycle_timer", "drive + idle + between-orders"],
  ["session_elapsed_timer", "Full session clock when present"],
];

/**
 * Multi-sheet Excel workbook for one day's trips (all timers + totals + legend + ZIP avgs).
 */
export function buildDailyTripReportExcel(trips = [], { date = "", liveRow = null, zipBenchmarks = null } = {}) {
  const ordered = [...(trips || [])].map(withAllTimers).sort(
    (a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0)
  );
  if (liveRow) {
    const live = withAllTimers(liveRow);
    if (!ordered.some((t) => t.id === live.id)) ordered.push(live);
  }

  const tripRows = [TRIP_HEADERS];
  ordered.forEach((t, i) => {
    const row = withAllTimers(t);
    tripRows.push([
      row.date || date,
      row.trip_number || i + 1,
      row.status || "completed",
      row.started_at || "",
      row.ended_at || "",
      row.drive_timer_hms,
      row.idle_timer_hms,
      row.between_orders_timer_hms,
      row.pause_timer_hms,
      row.active_timer_hms,
      row.cycle_timer_hms,
      row.session_elapsed_timer_hms,
      Number(row.drive_sec) || 0,
      Number(row.idle_sec) || 0,
      Number(row.between_orders_sec) || 0,
      Number(row.pause_sec) || 0,
      Number(row.active_sec) || 0,
      Number(row.cycle_sec) || 0,
      Number(row.elapsed_sec) || 0,
      Number(row.miles) || 0,
      row.earnings != null && row.earnings !== "" ? Number(row.earnings) : "",
      row.tips != null && row.tips !== "" ? Number(row.tips) : "",
      row.zip || "",
      row.label || "",
      row.app || "",
      row.pickup_lat ?? "",
      row.pickup_lng ?? "",
      row.dropoff_lat ?? "",
      row.dropoff_lng ?? "",
      row.notes || "",
      row.session_id || "",
      row.id || "",
    ]);
  });

  const sum = summarizeDayTrips(ordered);
  const totalsRows = [
    ["Metric", "Value"],
    ["date", date || ""],
    ["trips", sum.trips],
    ["completed_trips", sum.completed_trips],
    ["running_trips", sum.running_trips],
    ["drive_timer_hms", sum.drive_hms],
    ["idle_timer_hms", sum.idle_hms],
    ["between_orders_timer_hms", sum.between_orders_hms],
    ["pause_timer_hms", sum.pause_hms],
    ["active_timer_hms", sum.active_hms],
    ["cycle_timer_hms", sum.cycle_hms],
    ["drive_sec", sum.drive_sec],
    ["idle_sec", sum.idle_sec],
    ["between_orders_sec", sum.between_orders_sec],
    ["pause_sec", sum.pause_sec],
    ["active_sec", sum.active_sec],
    ["cycle_sec", sum.cycle_sec],
    ["miles", sum.miles],
    ["earnings", sum.earnings],
    ["deductible_estimate_usd", sum.deductible_est],
    ["irs_rate_usd_per_mile", IRS_MILEAGE_RATE_USD],
  ];

  const sheets = [
    { name: "Trips", rows: tripRows },
    { name: "Daily Totals", rows: totalsRows },
    { name: "Timer Legend", rows: TIMER_LEGEND },
  ];

  if (zipBenchmarks?.ranked?.length || zipBenchmarks?.overall?.trips > 0) {
    const zipRows = [
      ["zip", "source", "trips", "avg_pay", "avg_per_mile", "avg_per_hour", "avg_minutes", "earnings", "miles"],
    ];
    if (zipBenchmarks.overall?.trips > 0) {
      const o = zipBenchmarks.overall;
      zipRows.push([
        "ALL",
        "overall",
        o.trips,
        o.avg_pay ?? "",
        o.avg_per_mile ?? "",
        o.avg_per_hour ?? "",
        o.avg_minutes ?? "",
        o.earnings,
        o.miles,
      ]);
    }
    for (const z of zipBenchmarks.ranked || []) {
      zipRows.push([
        z.zip,
        "zip",
        z.trips,
        z.avg_pay ?? "",
        z.avg_per_mile ?? "",
        z.avg_per_hour ?? "",
        z.avg_minutes ?? "",
        z.earnings,
        z.miles,
      ]);
    }
    sheets.push({ name: "ZIP Averages", rows: zipRows });
  }

  return {
    filename: `titanos-daily-trips-${date || "report"}.xls`,
    sheets,
    xml: buildSpreadsheetMl(sheets, { title: "TitanOS Driver Report" }),
  };
}

/**
 * Mileage logbook Excel (classify Work / Personal + deductible estimates).
 */
export function buildLogbookExcel(enrichedTrips = []) {
  const header = [
    "date",
    "started_at",
    "ended_at",
    "miles",
    "purpose",
    "deductible",
    "deductible_estimate_usd",
    "drive_sec",
    "idle_sec",
    "stops",
    "zip",
    "notes",
  ];
  const rows = [header];
  for (const t of enrichedTrips || []) {
    rows.push([
      (t.started_at || "").slice(0, 10),
      t.started_at || "",
      t.ended_at || "",
      Number(t.miles) || 0,
      t.purpose_label || t.purpose || "",
      t.deductible ? "yes" : "no",
      Number(t.deductible_estimate) || 0,
      Number(t.drive_sec) || 0,
      Number(t.idle_sec) || 0,
      Number(t.stops) || 0,
      t.zip || t.raw?.zip || "",
      t.classification?.notes || t.notes || "",
    ]);
  }
  const sheets = [{ name: "Mileage Logbook", rows }];
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    filename: `titanos-mileage-logbook-${stamp}.xls`,
    sheets,
    xml: buildSpreadsheetMl(sheets, { title: "TitanOS Mileage Logbook" }),
  };
}
