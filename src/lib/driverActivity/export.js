/**
 * Tax-friendly export helpers — recordkeeping only, not tax advice.
 */

import { IRS_MILEAGE_RATE_USD } from "../driverHubMath.js";
import { buildStopLegReport } from "./betweenStops.js";

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Build CSV for archived work sessions.
 */
export function buildMileageCsv(history = [], stopsBySession = {}) {
  const header = [
    "date",
    "started_at",
    "ended_at",
    "miles",
    "drive_sec",
    "idle_sec",
    "stops",
    "avg_drive_between_stops_sec",
    "longest_drive_between_stops_sec",
    "shortest_drive_between_stops_sec",
    "avg_miles_between_stops",
    "max_speed_mph",
    "avg_speed_mph",
    "deductible_estimate_usd",
    "purpose",
    "notes",
  ];
  const lines = [header.join(",")];
  for (const s of history || []) {
    const miles = Number(s.miles) || 0;
    const detail = stopsBySession[s.id] || s.stops_detail || [];
    const report = buildStopLegReport(s, detail, { now: s.ended_at || s.started_at });
    lines.push(
      [
        (s.started_at || "").slice(0, 10),
        s.started_at || "",
        s.ended_at || "",
        miles,
        Number(s.drive_sec) || Number(s.elapsed_sec) || 0,
        Number(s.idle_sec) || 0,
        Number(s.stops) || report.summary.totalStops || 0,
        report.summary.avgDriveBetweenStopsSec,
        report.summary.longestDriveBetweenStopsSec,
        report.summary.shortestDriveBetweenStopsSec,
        report.summary.avgMilesBetweenStops,
        Number(s.max_speed_mph) || "",
        Number(s.avg_speed_mph) || "",
        Math.round(miles * IRS_MILEAGE_RATE_USD * 100) / 100,
        "Business / hauling / delivery",
        csvEscape(s.city || s.notes || "Driver Activity Engine"),
      ].join(",")
    );
  }

  lines.push("");
  lines.push(
    [
      "session_id",
      "stop_number",
      "label",
      "arrived_at",
      "departed_at",
      "stop_duration_sec",
      "drive_since_prev_sec",
      "miles_since_prev",
      "running_miles",
      "running_drive_sec",
      "lat",
      "lng",
      "auto",
    ].join(",")
  );

  for (const s of history || []) {
    const detail = stopsBySession[s.id] || s.stops_detail || [];
    const report = buildStopLegReport(s, detail, { now: s.ended_at || s.started_at });
    for (const st of report.stops) {
      lines.push(
        [
          s.id || "",
          st.stopNumber,
          csvEscape(st.label),
          st.arrived_at || "",
          st.departed_at || "",
          st.duration_sec,
          st.drive_since_prev_sec,
          st.miles_since_prev,
          st.running_miles,
          st.running_drive_sec,
          st.lat ?? "",
          st.lng ?? "",
          st.auto ? "yes" : "no",
        ].join(",")
      );
    }
    if (report.afterLast && (report.afterLast.drive_sec > 0 || report.afterLast.miles > 0)) {
      lines.push(
        [
          s.id || "",
          "after_last",
          "Driving after last stop",
          "",
          s.ended_at || "",
          "",
          report.afterLast.drive_sec,
          report.afterLast.miles,
          Number(s.miles) || "",
          Number(s.drive_sec) || "",
          "",
          "",
          "",
        ].join(",")
      );
    }
  }

  return lines.join("\n");
}

/** Single-session chronological report for recordkeeping. */
export function buildSessionChronologyCsv(session, stops = []) {
  const report = buildStopLegReport(session, stops, { now: session?.ended_at || new Date() });
  const lines = [
    "event_type,at,ends_at,label,drive_sec,miles,stop_duration_sec,stop_number",
  ];
  for (const ev of report.timeline) {
    lines.push(
      [
        ev.type,
        ev.at || "",
        ev.ends_at || "",
        csvEscape(ev.label || ""),
        ev.drive_sec ?? "",
        ev.miles ?? "",
        ev.duration_sec ?? "",
        ev.stopNumber ?? "",
      ].join(",")
    );
  }
  lines.push("");
  lines.push(
    "stop_number,arrived,departed,duration_sec,drive_since_prev_sec,miles_since_prev,running_miles,running_drive_sec"
  );
  for (const st of report.stops) {
    lines.push(
      [
        st.stopNumber,
        st.arrived_at,
        st.departed_at || "",
        st.duration_sec,
        st.drive_since_prev_sec,
        st.miles_since_prev,
        st.running_miles,
        st.running_drive_sec,
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
  if (typeof document === "undefined") return false;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
