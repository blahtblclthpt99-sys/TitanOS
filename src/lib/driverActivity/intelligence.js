/**
 * Driver Intelligence — pure analytics over Driver Hub sessions/stops.
 * Does not write GPS or session state; Hub API remains the source of truth.
 */

import { IRS_MILEAGE_RATE_USD } from "../driverHubMath.js";

/** Configurable rush windows (local time). */
export const DEFAULT_RUSH_WINDOWS = Object.freeze([
  { id: "breakfast", label: "Breakfast Rush", startHour: 6, endHour: 9 },
  { id: "lunch", label: "Lunch Rush", startHour: 11, endHour: 14 },
  { id: "afternoon", label: "Afternoon Slow", startHour: 14, endHour: 17 },
  { id: "dinner", label: "Dinner Rush", startHour: 17, endHour: 20 },
  { id: "late", label: "Late Evening", startHour: 20, endHour: 23 },
  { id: "overnight", label: "Overnight", startHour: 23, endHour: 6 },
]);

export const DEFAULT_WORTH_THRESHOLDS = Object.freeze({
  excellentHourly: 35,
  goodHourly: 25,
  fairHourly: 18,
  poorHourly: 12,
  maxMilesForExcellent: 8,
  fuelUsdPerGallon: 3.5,
  defaultMpg: 22,
});

export const WEEKDAY_NAMES = Object.freeze([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function hoursFromSec(sec) {
  return Math.max(0, num(sec) / 3600);
}

export function classifyRushWindow(date = new Date(), windows = DEFAULT_RUSH_WINDOWS) {
  const h = date.getHours() + date.getMinutes() / 60;
  for (const w of windows) {
    if (w.startHour < w.endHour) {
      if (h >= w.startHour && h < w.endHour) return w;
    } else {
      // overnight wrap
      if (h >= w.startHour || h < w.endHour) return w;
    }
  }
  return windows[windows.length - 1] || { id: "unknown", label: "Unknown" };
}

export function estimateFuelCost(miles, { mpg = 22, gasUsd = 3.5 } = {}) {
  const m = Math.max(0, num(miles));
  const g = Math.max(1, num(mpg, 22));
  return Math.round((m / g) * num(gasUsd, 3.5) * 100) / 100;
}

export function estimateWearCost(miles, perMile = 0.08) {
  return Math.round(Math.max(0, num(miles)) * num(perMile, 0.08) * 100) / 100;
}

/**
 * Normalize a Hub session into a Trip intelligence record.
 */
export function sessionToTrip(session, { mpg, gasUsd, windows } = {}) {
  if (!session?.id) return null;
  const started = session.started_at ? new Date(session.started_at) : null;
  const ended = session.ended_at ? new Date(session.ended_at) : session.active ? new Date() : null;
  const miles = num(session.miles ?? session.auto_miles);
  const driveSec = num(session.drive_sec);
  const idleSec = num(session.idle_sec);
  const elapsedSec =
    num(session.elapsed_sec) ||
    (started && ended ? Math.max(0, Math.round((ended - started) / 1000) - num(session.pause_accum_sec)) : 0);
  const earnings = num(session.earnings_gross);
  const tips = num(session.tips);
  const fuel = num(session.fuel_cost) || estimateFuelCost(miles, { mpg, gasUsd });
  const wear = estimateWearCost(miles);
  const expenses = Math.round((fuel + wear) * 100) / 100;
  const profit =
    earnings > 0 ? Math.round((earnings + tips - expenses) * 100) / 100 : Math.round(-expenses * 100) / 100;
  const driveHours = hoursFromSec(driveSec || elapsedSec);
  const dollarsPerMile = miles > 0 && earnings > 0 ? Math.round((earnings / miles) * 100) / 100 : null;
  const dollarsPerHour =
    driveHours > 0 && earnings > 0 ? Math.round((earnings / driveHours) * 100) / 100 : null;
  const rush = started ? classifyRushWindow(started, windows || DEFAULT_RUSH_WINDOWS) : null;
  const dow = started ? started.getDay() : null;
  const stops = Array.isArray(session.stops_detail)
    ? session.stops_detail
    : Array.isArray(session.stops)
      ? session.stops
      : [];
  const stopCount = typeof session.stops === "number" ? session.stops : stops.length;

  return {
    id: session.id,
    trip_number: null,
    type: "session",
    date: started ? started.toISOString().slice(0, 10) : null,
    started_at: session.started_at || null,
    ended_at: session.ended_at || null,
    active: Boolean(session.active),
    duration_sec: elapsedSec,
    drive_sec: driveSec,
    idle_sec: idleSec,
    miles,
    avg_speed_mph: num(session.avg_speed_mph),
    max_speed_mph: num(session.max_speed_mph),
    pickup: stops[0]
      ? { lat: stops[0].lat, lng: stops[0].lng, label: stops[0].label || "First stop" }
      : session.lat != null
        ? { lat: session.lat, lng: session.lng, label: session.city || "Start" }
        : null,
    dropoff: stops.length
      ? {
          lat: stops[stops.length - 1].lat,
          lng: stops[stops.length - 1].lng,
          label: stops[stops.length - 1].label || "Last stop",
        }
      : null,
    stops,
    stop_count: stopCount,
    earnings,
    tips,
    expenses,
    fuel_cost: fuel,
    wear_cost: wear,
    profit,
    dollars_per_mile: dollarsPerMile,
    dollars_per_hour: dollarsPerHour,
    platform: (session.apps && session.apps[0]) || session.platform || "General",
    apps: session.apps || [],
    notes: session.notes || "",
    rush_id: rush?.id || null,
    rush_label: rush?.label || null,
    weekday: dow,
    weekday_name: dow != null ? WEEKDAY_NAMES[dow] : null,
    is_weekend: dow === 0 || dow === 6,
    miles_source: session.miles_source || null,
    deductible_est: Math.round(miles * IRS_MILEAGE_RATE_USD * 100) / 100,
    raw: session,
  };
}

/** Expand stop-to-stop legs as individual trip records (never merged). */
export function legsFromSession(session, { mpg, gasUsd, windows } = {}) {
  const stops = Array.isArray(session?.stops_detail) ? [...session.stops_detail] : [];
  if (!stops.length) return [];
  stops.sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0));
  const trips = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const miles = num(stop.miles_since_prev ?? stop.miles_delta);
    const driveSec = num(stop.drive_since_prev_sec);
    const started = stop.started_at
      ? new Date(new Date(stop.started_at).getTime() - driveSec * 1000)
      : null;
    const ended = stop.started_at ? new Date(stop.started_at) : null;
    const fuel = estimateFuelCost(miles, { mpg, gasUsd });
    const wear = estimateWearCost(miles);
    const rush = started ? classifyRushWindow(started, windows || DEFAULT_RUSH_WINDOWS) : null;
    const dow = started ? started.getDay() : null;
    trips.push({
      id: `${session.id}__leg_${stop.id || i}`,
      parent_session_id: session.id,
      type: "leg",
      trip_number: i + 1,
      date: started ? started.toISOString().slice(0, 10) : session.started_at?.slice(0, 10),
      started_at: started?.toISOString() || stop.started_at,
      ended_at: ended?.toISOString() || stop.ended_at,
      active: false,
      duration_sec: driveSec + num(stop.duration_sec),
      drive_sec: driveSec,
      idle_sec: num(stop.duration_sec),
      miles,
      avg_speed_mph: driveSec > 0 ? Math.round((miles / (driveSec / 3600)) * 10) / 10 : 0,
      max_speed_mph: null,
      pickup: i > 0 ? { lat: stops[i - 1].lat, lng: stops[i - 1].lng, label: stops[i - 1].label } : null,
      dropoff: { lat: stop.lat, lng: stop.lng, label: stop.label || `Stop ${i + 1}` },
      stops: [stop],
      stop_count: 1,
      earnings: 0,
      tips: 0,
      expenses: Math.round((fuel + wear) * 100) / 100,
      fuel_cost: fuel,
      wear_cost: wear,
      profit: Math.round(-(fuel + wear) * 100) / 100,
      dollars_per_mile: null,
      dollars_per_hour: null,
      platform: stop.app || (session.apps && session.apps[0]) || "General",
      apps: stop.app ? [stop.app] : session.apps || [],
      notes: stop.note || "",
      rush_id: rush?.id || null,
      rush_label: rush?.label || null,
      weekday: dow,
      weekday_name: dow != null ? WEEKDAY_NAMES[dow] : null,
      is_weekend: dow === 0 || dow === 6,
      miles_source: session.miles_source || null,
      deductible_est: Math.round(miles * IRS_MILEAGE_RATE_USD * 100) / 100,
      raw: stop,
    });
  }
  return trips;
}

export function collectTrips(history = [], liveSession = null, liveStops = [], opts = {}) {
  const sessions = [...(Array.isArray(history) ? history : [])];
  if (liveSession?.id) {
    sessions.unshift({
      ...liveSession,
      stops_detail: Array.isArray(liveStops) ? liveStops : liveSession.stops_detail || [],
    });
  }
  const sessionTrips = sessions.map((s) => sessionToTrip(s, opts)).filter(Boolean);
  const legTrips = sessions.flatMap((s) => legsFromSession(s, opts));
  // Prefer session trips for dashboards; legs available for detail drill-down
  const numbered = sessionTrips
    .slice()
    .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0))
    .map((t, i) => ({ ...t, trip_number: i + 1 }));
  return {
    sessions: numbered.sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0)),
    legs: legTrips.sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0)),
  };
}

export function findTrip(tripId, history = [], liveSession = null, liveStops = [], opts = {}) {
  const { sessions, legs } = collectTrips(history, liveSession, liveStops, opts);
  return sessions.find((t) => t.id === tripId) || legs.find((t) => t.id === tripId) || null;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

export function summarizeTrips(trips = []) {
  const list = Array.isArray(trips) ? trips : [];
  const miles = list.reduce((s, t) => s + num(t.miles), 0);
  const driveSec = list.reduce((s, t) => s + num(t.drive_sec), 0);
  const idleSec = list.reduce((s, t) => s + num(t.idle_sec), 0);
  const earnings = list.reduce((s, t) => s + num(t.earnings) + num(t.tips), 0);
  const expenses = list.reduce((s, t) => s + num(t.expenses), 0);
  const profit = Math.round((earnings - expenses) * 100) / 100;
  const withEarn = list.filter((t) => num(t.earnings) > 0);
  const longest = list.slice().sort((a, b) => num(b.miles) - num(a.miles))[0] || null;
  const shortest =
    list.filter((t) => num(t.miles) > 0).slice().sort((a, b) => num(a.miles) - num(b.miles))[0] ||
    null;
  const bestPay = withEarn.slice().sort((a, b) => num(b.earnings) - num(a.earnings))[0] || null;
  const worstPay = withEarn.slice().sort((a, b) => num(a.earnings) - num(b.earnings))[0] || null;
  const driveHours = hoursFromSec(driveSec);
  return {
    trips: list.length,
    miles: Math.round(miles * 10) / 10,
    drive_sec: driveSec,
    idle_sec: idleSec,
    earnings: Math.round(earnings * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    profit,
    avg_trip_miles: list.length ? Math.round((miles / list.length) * 10) / 10 : 0,
    avg_dollars_per_mile: miles > 0 && earnings > 0 ? Math.round((earnings / miles) * 100) / 100 : null,
    avg_dollars_per_hour:
      driveHours > 0 && earnings > 0 ? Math.round((earnings / driveHours) * 100) / 100 : null,
    longest,
    shortest,
    best_paying: bestPay,
    lowest_paying: worstPay,
    deductible_est: Math.round(miles * IRS_MILEAGE_RATE_USD * 100) / 100,
  };
}

export function dailySummary(trips, dateISO) {
  const day = dateISO || new Date().toISOString().slice(0, 10);
  return { date: day, ...summarizeTrips((trips || []).filter((t) => t.date === day)) };
}

export function weeklyByWeekday(trips = []) {
  const buckets = WEEKDAY_NAMES.map((name, weekday) => {
    const rows = (trips || []).filter((t) => t.weekday === weekday);
    const s = summarizeTrips(rows);
    return {
      weekday,
      name,
      is_weekend: weekday === 0 || weekday === 6,
      ...s,
      avg_earnings: rows.length ? Math.round((s.earnings / rows.length) * 100) / 100 : 0,
    };
  });
  const withData = buckets.filter((b) => b.trips > 0);
  const best = withData.slice().sort((a, b) => b.earnings - a.earnings)[0] || null;
  const worst = withData.slice().sort((a, b) => a.earnings - b.earnings)[0] || null;
  return { days: buckets, best_day: best, worst_day: worst };
}

export function weekdayWeekendCompare(trips = []) {
  const weekdays = (trips || []).filter((t) => !t.is_weekend);
  const weekends = (trips || []).filter((t) => t.is_weekend);
  const w = summarizeTrips(weekdays);
  const e = summarizeTrips(weekends);
  const perTrip = (s) => (s.trips ? Math.round((s.earnings / s.trips) * 100) / 100 : 0);
  return {
    weekday: { ...w, avg_per_trip: perTrip(w) },
    weekend: { ...e, avg_per_trip: perTrip(e) },
    recommendation:
      w.trips === 0 && e.trips === 0
        ? "Log a few shifts to unlock weekday vs weekend coaching."
        : w.avg_dollars_per_hour != null &&
            e.avg_dollars_per_hour != null &&
            e.avg_dollars_per_hour > w.avg_dollars_per_hour * 1.1
          ? "Weekends currently pay a higher hourly rate for you — prioritize Sat/Sun dinner windows."
          : w.avg_dollars_per_hour != null &&
              e.avg_dollars_per_hour != null &&
              w.avg_dollars_per_hour > e.avg_dollars_per_hour * 1.1
            ? "Weekdays outperform weekends for your hourly rate — protect dinner rush on weeknights."
            : "Weekday and weekend earnings are similar — optimize by rush window instead.",
  };
}

export function rushPeriodStats(trips = [], windows = DEFAULT_RUSH_WINDOWS) {
  return windows.map((w) => {
    const rows = (trips || []).filter((t) => t.rush_id === w.id);
    return { ...w, ...summarizeTrips(rows) };
  });
}

/**
 * Rate a trip opportunity (or completed trip) ★–★★★★★
 */
export function rateTripWorth(input = {}, thresholds = DEFAULT_WORTH_THRESHOLDS) {
  const miles = Math.max(0, num(input.miles, num(input.estimated_miles)));
  const minutes = Math.max(1, num(input.drive_minutes, hoursFromSec(input.drive_sec) * 60 || miles * 3));
  const earnings = Math.max(0, num(input.earnings, num(input.expected_earnings)));
  const tips = Math.max(0, num(input.tips));
  const mpg = num(input.mpg, thresholds.defaultMpg);
  const gas = num(input.gasUsd, thresholds.fuelUsdPerGallon);
  const fuel = estimateFuelCost(miles, { mpg, gasUsd: gas });
  const wear = estimateWearCost(miles);
  const totalEarn = earnings + tips;
  const profit = Math.round((totalEarn - fuel - wear) * 100) / 100;
  const hourly = minutes > 0 ? (totalEarn / minutes) * 60 : 0;
  const perMile = miles > 0 ? totalEarn / miles : 0;

  let stars = 3;
  let reason = "Fair return for distance and time.";
  if (hourly >= thresholds.excellentHourly && miles <= thresholds.maxMilesForExcellent) {
    stars = 5;
    reason = "Excellent hourly return with controlled mileage.";
  } else if (hourly >= thresholds.goodHourly) {
    stars = 4;
    reason = "Strong hourly return — worth taking.";
  } else if (hourly >= thresholds.fairHourly) {
    stars = 3;
    reason = "Fair — acceptable if you stay in the zone.";
  } else if (hourly >= thresholds.poorHourly) {
    stars = 2;
    reason = miles > 12 ? "Low pay for distance." : "Below your usual hourly target.";
  } else {
    stars = 1;
    reason = totalEarn <= 0 ? "No earnings data — track payout to score accurately." : "Avoid — weak hourly and thin profit.";
  }
  if (miles > 15 && hourly < thresholds.goodHourly && stars > 2) {
    stars = Math.min(stars, 2);
    reason = "High mileage reduces profit per mile.";
  }

  const labels = { 5: "Excellent", 4: "Good", 3: "Fair", 2: "Poor", 1: "Avoid" };
  return {
    stars,
    label: labels[stars],
    reason,
    expected_earnings: Math.round(totalEarn * 100) / 100,
    estimated_miles: Math.round(miles * 10) / 10,
    estimated_drive_min: Math.round(minutes),
    estimated_fuel: fuel,
    estimated_hourly: Math.round(hourly * 100) / 100,
    estimated_per_mile: Math.round(perMile * 100) / 100,
    estimated_profit: profit,
  };
}

export function buildCoachInsights(trips = [], { todayISO } = {}) {
  const list = Array.isArray(trips) ? trips : [];
  const insights = [];
  if (list.length < 1) {
    return [
      {
        id: "start",
        text: "Start Auto GPS and turn on money autopilot — TitanOS denies cheap trips so your $/hr goes up, not just your trip count.",
      },
    ];
  }

  const weekly = weeklyByWeekday(list);
  if (weekly.best_day && weekly.worst_day && weekly.best_day.weekday !== weekly.worst_day.weekday) {
    const bestEarn = weekly.best_day.earnings;
    const worstEarn = Math.max(0.01, weekly.worst_day.earnings);
    if (bestEarn > worstEarn * 1.15) {
      const pct = Math.round(((bestEarn - worstEarn) / worstEarn) * 100);
      insights.push({
        id: "best-day",
        text: `${weekly.best_day.name} earns about ${pct}% more than ${weekly.worst_day.name} in your history.`,
      });
    }
  }

  const rush = rushPeriodStats(list).filter((r) => r.trips > 0);
  if (rush.length >= 2) {
    const ranked = rush.slice().sort((a, b) => (b.avg_dollars_per_hour || 0) - (a.avg_dollars_per_hour || 0));
    if (ranked[0].avg_dollars_per_hour) {
      insights.push({
        id: "rush",
        text: `Your strongest window is ${ranked[0].label} (~$${ranked[0].avg_dollars_per_hour}/hr when earnings are logged).`,
      });
    }
  }

  const long = list.filter((t) => num(t.miles) > 10);
  const short = list.filter((t) => num(t.miles) > 0 && num(t.miles) <= 10);
  if (long.length && short.length) {
    const longPm = avg(long.map((t) => num(t.dollars_per_mile)).filter((n) => n > 0));
    const shortPm = avg(short.map((t) => num(t.dollars_per_mile)).filter((n) => n > 0));
    if (shortPm > longPm * 1.15 && shortPm > 0) {
      insights.push({
        id: "miles",
        text: "Trips over 10 miles usually reduce your dollars-per-mile — favor shorter stacks when possible.",
      });
    }
  }

  const idleRatio = list.map((t) => {
    const d = num(t.drive_sec);
    const i = num(t.idle_sec);
    return d + i > 0 ? i / (d + i) : 0;
  });
  const avgIdle = avg(idleRatio);
  if (avgIdle > 0.35) {
    insights.push({
      id: "idle",
      text: `You idle about ${Math.round(avgIdle * 100)}% of session time — reposition during slow windows to cut dead time.`,
    });
  }

  const ww = weekdayWeekendCompare(list);
  if (ww.recommendation) insights.push({ id: "ww", text: ww.recommendation });

  const today = dailySummary(list, todayISO || new Date().toISOString().slice(0, 10));
  if (today.trips > 0) {
    insights.push({
      id: "today",
      text: `Today: ${today.trips} trip${today.trips === 1 ? "" : "s"}, ${today.miles} mi, ${Math.round(today.drive_sec / 60)} min drive.`,
    });
  }

  return insights.slice(0, 6);
}

export function goalsProgress(goals = {}, summary = {}) {
  const g = {
    daily_earnings: num(goals.daily_earnings),
    weekly_earnings: num(goals.weekly_earnings),
    monthly_earnings: num(goals.monthly_earnings),
    daily_trips: num(goals.daily_trips),
    daily_miles_cap: num(goals.daily_miles_cap),
    daily_hours_cap: num(goals.daily_hours_cap),
  };
  const pct = (have, want) => (want > 0 ? Math.min(100, Math.round((have / want) * 100)) : null);
  return {
    daily_earnings: {
      target: g.daily_earnings,
      current: num(summary.today?.earnings),
      pct: pct(num(summary.today?.earnings), g.daily_earnings),
    },
    weekly_earnings: {
      target: g.weekly_earnings,
      current: num(summary.week?.earnings),
      pct: pct(num(summary.week?.earnings), g.weekly_earnings),
    },
    monthly_earnings: {
      target: g.monthly_earnings,
      current: num(summary.month?.earnings),
      pct: pct(num(summary.month?.earnings), g.monthly_earnings),
    },
    daily_trips: {
      target: g.daily_trips,
      current: num(summary.today?.trips),
      pct: pct(num(summary.today?.trips), g.daily_trips),
    },
  };
}

/** Period helpers */
export function filterTripsByPeriod(trips, period, now = new Date()) {
  const list = Array.isArray(trips) ? trips : [];
  const today = now.toISOString().slice(0, 10);
  if (period === "today") return list.filter((t) => t.date === today);
  if (period === "week") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + mondayOffset);
    return list.filter((t) => t.started_at && new Date(t.started_at) >= start);
  }
  if (period === "month") {
    const prefix = today.slice(0, 7);
    return list.filter((t) => (t.date || "").startsWith(prefix));
  }
  return list;
}
