/**
 * Permanent per-trip journal — every drive leg stays its own row (never merged).
 * Drive time and idle time are stored as separate fields for spreadsheet export.
 *
 * Local MAX_JOURNAL is a device ring buffer. After migration 034, rows sync to
 * `driver_trips` when online so multi-device / long history can scale.
 */
import { readLocal, writeLocal } from "../localStore.js";
import { IRS_MILEAGE_RATE_USD } from "../driverHubMath.js";

const PREFIX = "titanos_driver";
const JOURNAL_KEY = "trip_journal";
const MAX_JOURNAL = 2000;

function readJournal(userId) {
  const rows = readLocal(PREFIX, userId, JOURNAL_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function writeJournal(userId, rows) {
  writeLocal(PREFIX, userId, JOURNAL_KEY, (rows || []).slice(0, MAX_JOURNAL));
}

function fmtHms(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Attach every derived timer field so reports always have a complete set. */
export function withAllTimers(row = {}) {
  const drive_sec = Math.max(0, Number(row.drive_sec) || 0);
  const idle_sec = Math.max(0, Number(row.idle_sec) || 0);
  const between_orders_sec = Math.max(0, Number(row.between_orders_sec) || 0);
  const pause_sec = Math.max(0, Number(row.pause_sec) || 0);
  // Wall clock for this trip: drive + stop idle (not between-orders — that's gap before this trip)
  const active_sec = drive_sec + idle_sec;
  // Full cycle including gap waiting for next order
  const cycle_sec = drive_sec + idle_sec + between_orders_sec;
  // Clock including pause (session-level usually)
  const elapsed_sec = Math.max(
    0,
    Number(row.elapsed_sec) || active_sec + pause_sec
  );
  return {
    ...row,
    drive_sec,
    idle_sec,
    between_orders_sec,
    pause_sec,
    active_sec,
    cycle_sec,
    elapsed_sec,
    drive_hms: fmtHms(drive_sec),
    idle_hms: fmtHms(idle_sec),
    between_orders_hms: fmtHms(between_orders_sec),
    pause_hms: fmtHms(pause_sec),
    active_hms: fmtHms(active_sec),
    cycle_hms: fmtHms(cycle_sec),
    elapsed_hms: fmtHms(elapsed_sec),
    // Aliases for spreadsheet clarity
    drive_timer_hms: fmtHms(drive_sec),
    idle_timer_hms: fmtHms(idle_sec),
    between_orders_timer_hms: fmtHms(between_orders_sec),
    stop_idle_timer_hms: fmtHms(idle_sec),
    pause_timer_hms: fmtHms(pause_sec),
    active_timer_hms: fmtHms(active_sec),
    cycle_timer_hms: fmtHms(cycle_sec),
    session_elapsed_timer_hms: fmtHms(elapsed_sec),
  };
}

/**
 * Build a journal row from a completed stop leg (drive into that stop).
 */
export function legToJournalRow(session, stop, prevStop, index) {
  const driveSec = Number(stop.drive_since_prev_sec) || 0;
  const idleSec = Number(stop.duration_sec) || 0;
  const betweenIdle = Number(stop.between_orders_sec) || 0;
  // Idle for this trip = wait at stop; between-order idle counted on next leg start
  const miles = Number(stop.miles_since_prev ?? stop.miles_delta) || 0;
  const arrived = stop.started_at ? new Date(stop.started_at) : null;
  const started =
    arrived && driveSec > 0
      ? new Date(arrived.getTime() - driveSec * 1000)
      : prevStop?.ended_at
        ? new Date(prevStop.ended_at)
        : session?.started_at
          ? new Date(session.started_at)
          : arrived;
  const ended = stop.ended_at ? new Date(stop.ended_at) : arrived;

  return withAllTimers({
    id: `trip_${session?.id || "sess"}_${stop.id || index}`,
    session_id: session?.id || null,
    trip_number: index + 1,
    date: (started || arrived || new Date()).toISOString().slice(0, 10),
    started_at: started?.toISOString() || stop.started_at || null,
    ended_at: ended?.toISOString() || stop.ended_at || null,
    status: stop.ended_at ? "completed" : "running",
    drive_sec: driveSec,
    idle_sec: idleSec,
    between_orders_sec: betweenIdle,
    pause_sec: 0,
    miles: Math.round(miles * 10) / 10,
    label: stop.label || `Trip ${index + 1}`,
    app: stop.app || (session?.apps && session.apps[0]) || "",
    pickup_lat: prevStop?.lat ?? session?.lat ?? null,
    pickup_lng: prevStop?.lng ?? session?.lng ?? null,
    dropoff_lat: stop.lat ?? null,
    dropoff_lng: stop.lng ?? null,
    auto: Boolean(stop.auto),
    earnings: null,
    tips: null,
    zip: stop.zip || session?.zip || "",
    notes: stop.note || "",
    created_at: new Date().toISOString(),
  });
}

/** Upsert one trip row (idempotent by id). */
export function upsertTripJournal(userId, row) {
  if (!userId || !row?.id) return null;
  const rows = readJournal(userId);
  const idx = rows.findIndex((r) => r.id === row.id);
  const merged = idx >= 0 ? { ...rows[idx], ...row } : row;
  if (idx >= 0) rows[idx] = merged;
  else rows.unshift(merged);
  writeJournal(userId, rows);
  void syncTripJournalRowToCloud(userId, merged).catch(() => {});
  return merged;
}

/**
 * Best-effort cloud upsert into `driver_trips` (migration 034).
 * No-ops when offline / table missing / unauthenticated.
 */
export async function syncTripJournalRowToCloud(userId, row) {
  if (!userId || !row?.id) return { ok: false };
  try {
    const { supabase } = await import("@/api/supabaseClient");
    const payload = {
      user_id: userId,
      client_id: String(row.id),
      started_at: row.started_at || null,
      ended_at: row.ended_at || null,
      status: row.status || "completed",
      miles: Number(row.miles) || 0,
      earnings: row.earnings != null && row.earnings !== "" ? Number(row.earnings) : null,
      payload: row,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("driver_trips").upsert(payload, {
      onConflict: "user_id,client_id",
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || "sync_failed" };
  }
}

/** Sync all stop legs from a session into the journal (each stop = one trip). */
export function syncSessionLegsToJournal(userId, session, stops = []) {
  if (!userId || !session?.id) return [];
  const ordered = [...(Array.isArray(stops) ? stops : [])].sort(
    (a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0)
  );
  const written = [];
  for (let i = 0; i < ordered.length; i++) {
    const stop = ordered[i];
    if (!stop.ended_at && !stop.started_at) continue;
    const row = legToJournalRow(session, stop, i > 0 ? ordered[i - 1] : null, i);
    upsertTripJournal(userId, row);
    written.push(row);
  }
  // If session ended with miles but zero stops, still keep one whole-session trip
  if (written.length === 0 && (Number(session.miles) > 0 || Number(session.drive_sec) > 0)) {
    const row = withAllTimers({
      id: `trip_${session.id}_session`,
      session_id: session.id,
      trip_number: 1,
      date: (session.started_at || "").slice(0, 10),
      started_at: session.started_at,
      ended_at: session.ended_at || new Date().toISOString(),
      status: session.active ? "running" : "completed",
      drive_sec: Number(session.drive_sec) || 0,
      idle_sec: Number(session.idle_sec) || 0,
      between_orders_sec: 0,
      pause_sec: Number(session.pause_accum_sec) || 0,
      elapsed_sec: Number(session.elapsed_sec) || 0,
      miles: Number(session.miles) || 0,
      label: "Work session",
      app: (session.apps && session.apps[0]) || "",
      pickup_lat: session.lat ?? null,
      pickup_lng: session.lng ?? null,
      dropoff_lat: null,
      dropoff_lng: null,
      auto: session.miles_source === "gps",
      earnings: Number(session.earnings_gross) || null,
      tips: Number(session.tips) || null,
      zip: session.zip || "",
      notes: session.notes || "",
      created_at: new Date().toISOString(),
    });
    upsertTripJournal(userId, row);
    written.push(row);
  }
  return written;
}

export function listTripJournal(userId, { date = null } = {}) {
  let rows = readJournal(userId).map(withAllTimers);
  if (date) rows = rows.filter((r) => r.date === date);
  return rows.sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0));
}

export function patchTripJournalEarnings(userId, tripId, { earnings, tips, notes, zip } = {}) {
  const rows = readJournal(userId);
  const idx = rows.findIndex((r) => r.id === tripId);
  if (idx < 0) return null;
  rows[idx] = withAllTimers({
    ...rows[idx],
    earnings: earnings != null ? Number(earnings) : rows[idx].earnings,
    tips: tips != null ? Number(tips) : rows[idx].tips,
    notes: notes != null ? String(notes) : rows[idx].notes,
    zip: zip != null ? String(zip).replace(/\D/g, "").slice(0, 5) : rows[idx].zip || "",
  });
  writeJournal(userId, rows);
  return rows[idx];
}

/**
 * Snapshot live session timers into a synthetic "running" row for today's report.
 */
export function liveSessionTimerRow(session, stops = []) {
  if (!session?.active) return null;
  const open = (Array.isArray(stops) ? stops : []).find((s) => !s.ended_at);
  const drive_sec = Number(session.drive_sec) || 0;
  const idle_sec = Number(session.idle_sec) || 0;
  const pause_sec = Number(session.pause_accum_sec) || 0;
  let elapsed_sec = Number(session.elapsed_sec) || 0;
  if (!elapsed_sec && session.started_at) {
    elapsed_sec = Math.max(
      0,
      Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000) - pause_sec
    );
  }
  return withAllTimers({
    id: `trip_${session.id}_LIVE`,
    session_id: session.id,
    trip_number: 0,
    date: (session.started_at || new Date().toISOString()).slice(0, 10),
    started_at: session.started_at,
    ended_at: null,
    status: "running",
    drive_sec,
    idle_sec,
    between_orders_sec: 0,
    pause_sec,
    elapsed_sec,
    miles: Number(session.miles) || 0,
    label: open ? `LIVE · at stop (${open.label || "stop"})` : "LIVE · in progress",
    app: (session.apps && session.apps[0]) || "",
    notes: "Running timers — not a closed trip yet",
    created_at: new Date().toISOString(),
  });
}

export function summarizeDayTrips(trips = []) {
  const list = (Array.isArray(trips) ? trips : []).map(withAllTimers);
  const sum = (key) => list.reduce((s, t) => s + (Number(t[key]) || 0), 0);
  const drive_sec = sum("drive_sec");
  const idle_sec = sum("idle_sec");
  const between_orders_sec = sum("between_orders_sec");
  const pause_sec = sum("pause_sec");
  const active_sec = sum("active_sec");
  const cycle_sec = sum("cycle_sec");
  const miles = sum("miles");
  const earnings = list.reduce(
    (s, t) => s + (Number(t.earnings) || 0) + (Number(t.tips) || 0),
    0
  );
  return {
    trips: list.filter((t) => t.status !== "running" || t.trip_number === 0).length,
    completed_trips: list.filter((t) => t.status !== "running").length,
    running_trips: list.filter((t) => t.status === "running").length,
    drive_sec,
    idle_sec,
    between_orders_sec,
    pause_sec,
    active_sec,
    cycle_sec,
    drive_hms: fmtHms(drive_sec),
    idle_hms: fmtHms(idle_sec),
    between_orders_hms: fmtHms(between_orders_sec),
    pause_hms: fmtHms(pause_sec),
    active_hms: fmtHms(active_sec),
    cycle_hms: fmtHms(cycle_sec),
    miles: Math.round(miles * 10) / 10,
    earnings: Math.round(earnings * 100) / 100,
    deductible_est: Math.round(miles * IRS_MILEAGE_RATE_USD * 100) / 100,
  };
}

/**
 * Spreadsheet-ready daily CSV — every timer column included.
 */
export function buildDailyTripReportCsv(trips = [], { date = "", liveRow = null } = {}) {
  const header = [
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
  const lines = [header.join(",")];
  const ordered = [...(trips || [])].map(withAllTimers).sort(
    (a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0)
  );
  if (liveRow) {
    const live = withAllTimers(liveRow);
    if (!ordered.some((t) => t.id === live.id)) ordered.push(live);
  }

  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  ordered.forEach((t, i) => {
    const row = withAllTimers(t);
    lines.push(
      [
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
        row.drive_sec,
        row.idle_sec,
        row.between_orders_sec,
        row.pause_sec,
        row.active_sec,
        row.cycle_sec,
        row.elapsed_sec,
        Number(row.miles) || 0,
        row.earnings ?? "",
        row.tips ?? "",
        esc(row.zip || ""),
        esc(row.label),
        esc(row.app),
        row.pickup_lat ?? "",
        row.pickup_lng ?? "",
        row.dropoff_lat ?? "",
        row.dropoff_lng ?? "",
        esc(row.notes),
        row.session_id || "",
        row.id || "",
      ].join(",")
    );
  });

  const sum = summarizeDayTrips(ordered);
  lines.push("");
  lines.push("TIMER LEGEND");
  lines.push("drive_timer,Moving / en-route time only");
  lines.push("idle_timer,Stopped at customer or restaurant (stop dwell)");
  lines.push("between_orders_timer,Gap waiting after previous drop before this trip started");
  lines.push("pause_timer,Manual pause on the work session");
  lines.push("active_timer,drive + idle for this trip");
  lines.push("cycle_timer,drive + idle + between-orders");
  lines.push("session_elapsed_timer,Full session clock when present");
  lines.push("");
  lines.push("DAILY TOTALS");
  lines.push(`trips,${sum.trips}`);
  lines.push(`completed_trips,${sum.completed_trips}`);
  lines.push(`running_trips,${sum.running_trips}`);
  lines.push(`drive_timer_hms,${sum.drive_hms}`);
  lines.push(`idle_timer_hms,${sum.idle_hms}`);
  lines.push(`between_orders_timer_hms,${sum.between_orders_hms}`);
  lines.push(`pause_timer_hms,${sum.pause_hms}`);
  lines.push(`active_timer_hms,${sum.active_hms}`);
  lines.push(`cycle_timer_hms,${sum.cycle_hms}`);
  lines.push(`drive_sec,${sum.drive_sec}`);
  lines.push(`idle_sec,${sum.idle_sec}`);
  lines.push(`between_orders_sec,${sum.between_orders_sec}`);
  lines.push(`pause_sec,${sum.pause_sec}`);
  lines.push(`active_sec,${sum.active_sec}`);
  lines.push(`cycle_sec,${sum.cycle_sec}`);
  lines.push(`miles,${sum.miles}`);
  lines.push(`earnings,${sum.earnings}`);
  lines.push(`deductible_estimate_usd,${sum.deductible_est}`);
  return lines.join("\n");
}

export { fmtHms as formatTimerHms };
