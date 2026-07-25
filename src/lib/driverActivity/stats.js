/**
 * Aggregate driver activity stats from session history + optional live session.
 */

import { IRS_MILEAGE_RATE_USD } from "../driverHubMath.js";
import { round1 } from "./geo.js";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun
  x.setDate(x.getDate() - day);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function sessionStart(row) {
  return new Date(row.started_at || row.ended_at || 0).getTime();
}

function inRange(row, from, to) {
  const t = sessionStart(row);
  return t >= from.getTime() && t < to.getTime();
}

function summarize(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const miles = round1(list.reduce((s, r) => s + (Number(r.miles) || 0), 0));
  const driveSec = list.reduce((s, r) => s + (Number(r.drive_sec) || Number(r.elapsed_sec) || 0), 0);
  const idleSec = list.reduce((s, r) => s + (Number(r.idle_sec) || 0), 0);
  const stops = list.reduce((s, r) => s + (Number(r.stops) || 0), 0);
  const trips = list.length;
  const lengths = list.map((r) => Number(r.miles) || 0).filter((n) => n > 0);
  const longest = lengths.length ? Math.max(...lengths) : 0;
  const avgTrip = trips > 0 ? round1(miles / trips) : 0;
  return {
    trips,
    miles,
    stops,
    driveSec,
    idleSec,
    driveHours: Math.round((driveSec / 3600) * 100) / 100,
    idleHours: Math.round((idleSec / 3600) * 100) / 100,
    avgTripLength: avgTrip,
    longestTrip: round1(longest),
    deductibleMiles: miles,
    deductibleEstimateUsd: Math.round(miles * IRS_MILEAGE_RATE_USD * 100) / 100,
  };
}

/**
 * @param {object[]} history - archived sessions
 * @param {object|null} liveSession - active session (optional)
 * @param {Date} [now]
 */
export function computeActivityStats(history = [], liveSession = null, now = new Date()) {
  const rows = [...(history || [])];
  if (liveSession?.active) {
    rows.unshift({
      ...liveSession,
      miles: Number(liveSession.miles || 0),
      drive_sec: Number(liveSession.drive_sec || 0),
      idle_sec: Number(liveSession.idle_sec || 0),
      stops: Number(liveSession.stops || 0),
      started_at: liveSession.started_at,
    });
  }

  const todayFrom = startOfDay(now);
  const weekFrom = startOfWeek(now);
  const monthFrom = startOfMonth(now);
  const tomorrow = new Date(todayFrom);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(weekFrom);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextMonth = new Date(monthFrom);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    today: summarize(rows.filter((r) => inRange(r, todayFrom, tomorrow))),
    week: summarize(rows.filter((r) => inRange(r, weekFrom, nextWeek))),
    month: summarize(rows.filter((r) => inRange(r, monthFrom, nextMonth))),
    all: summarize(rows),
    irsRate: IRS_MILEAGE_RATE_USD,
  };
}
