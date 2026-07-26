/**
 * DoorDash Smart Delivery Workflow — pure state machine + persistence.
 * Guided stages with primary/secondary timers, GPS miles, and analytics.
 */

import { readLocal, writeLocal, uid } from "../localStore.js";
import { classifyRushWindow } from "./intelligence.js";

export const DD_PREFIX = "titanos_driver";
export const DD_ACTIVE_SUFFIX = "doordash_active";
export const DD_HISTORY_SUFFIX = "doordash_history";
export const DD_EVENT = "titanos-doordash-workflow";

export const DD_SCREENS = Object.freeze({
  START: 1,
  TO_RESTAURANT: 2,
  AT_RESTAURANT: 3,
  TO_CUSTOMER: 4,
  AT_CUSTOMER: 5,
});

export const DD_ORDER_TYPES = Object.freeze([
  { id: "slow_single", label: "Slow Business Single", column: "left", stack: 1 },
  { id: "slow_double", label: "Slow Business Double", column: "left", stack: 2 },
  { id: "slow_triple", label: "Slow Business Triple", column: "left", stack: 3 },
  { id: "single", label: "Single", column: "right", stack: 1 },
  { id: "double", label: "Double", column: "right", stack: 2 },
  { id: "triple", label: "Triple", column: "right", stack: 3 },
]);

export const DD_DEPART_SPEED_MPH = 15;
export const DD_DEPART_HOLD_SEC = 10;
export const DD_HISTORY_MAX = 200;

export const DD_STAGE_META = Object.freeze({
  [DD_SCREENS.START]: { step: 0, label: "Ready", short: "Start" },
  [DD_SCREENS.TO_RESTAURANT]: { step: 1, label: "Driving to restaurant", short: "Pickup" },
  [DD_SCREENS.AT_RESTAURANT]: { step: 2, label: "Waiting at restaurant", short: "Wait" },
  [DD_SCREENS.TO_CUSTOMER]: { step: 3, label: "Driving to customer", short: "Dropoff" },
  [DD_SCREENS.AT_CUSTOMER]: { step: 4, label: "Completing delivery", short: "Hand off" },
});

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** In-memory last GPS for instant taps (no getCurrentPosition wait). */
let _lastGps = null;

export function formatTimerHms(ms, now = Date.now()) {
  const totalSec = Math.max(0, Math.floor(timerElapsedMs(ms, now) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** @param {{ accumulatedMs?: number, runningSince?: number|null }} timer */
export function timerElapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  const base = Number(timer.accumulatedMs || 0);
  if (timer.runningSince != null) {
    return base + Math.max(0, now - Number(timer.runningSince));
  }
  return base;
}

export function pauseTimer(timer, now = Date.now()) {
  if (!timer) return { accumulatedMs: 0, runningSince: null };
  if (timer.runningSince == null) return { ...timer };
  return {
    accumulatedMs: timerElapsedMs(timer, now),
    runningSince: null,
  };
}

export function resumeTimer(timer, now = Date.now()) {
  if (!timer) return { accumulatedMs: 0, runningSince: now };
  if (timer.runningSince != null) return { ...timer };
  return {
    accumulatedMs: Number(timer.accumulatedMs || 0),
    runningSince: now,
  };
}

export function startTimer(now = Date.now()) {
  return { accumulatedMs: 0, runningSince: now };
}

export function stopTimer(timer, now = Date.now()) {
  return pauseTimer(timer, now);
}

export function orderTypeById(id) {
  return DD_ORDER_TYPES.find((t) => t.id === id) || null;
}

function point(gps) {
  if (!gps || !Number.isFinite(gps.lat) || !Number.isFinite(gps.lng)) return null;
  return {
    lat: Number(gps.lat),
    lng: Number(gps.lng),
    accuracy: gps.accuracy != null ? Number(gps.accuracy) : undefined,
    at: gps.at || new Date().toISOString(),
  };
}

export function rememberGps(gps) {
  const p = point(gps);
  if (p) _lastGps = p;
  return _lastGps;
}

export function lastKnownGps() {
  return _lastGps;
}

function pushEvent(delivery, type, extras = {}) {
  const events = Array.isArray(delivery.events) ? delivery.events.slice() : [];
  events.push({
    id: uid(),
    type,
    at: extras.at || new Date().toISOString(),
    gps: point(extras.gps) || null,
    note: extras.note || null,
  });
  return events;
}

export function createDelivery({ orderTypeId, gps, now = Date.now() }) {
  const ot = orderTypeById(orderTypeId);
  if (!ot) throw new Error("Unknown order type");
  const started = new Date(now);
  rememberGps(gps);
  return {
    id: uid(),
    platform: "DoorDash",
    orderTypeId: ot.id,
    orderTypeLabel: ot.label,
    stackSize: ot.stack,
    status: "active",
    screen: DD_SCREENS.TO_RESTAURANT,
    startedAt: started.toISOString(),
    endedAt: null,
    dayOfWeek: DAY_NAMES[started.getDay()],
    dateLocal: started.toLocaleDateString(),
    timeLocal: started.toLocaleTimeString(),
    startGps: point(gps),
    primaryTimer: startTimer(now),
    secondaryTimer: { accumulatedMs: 0, runningSince: null },
    completionTimer: { accumulatedMs: 0, runningSince: null },
    miles: 0,
    milesTracking: true,
    gpsAvailable: true,
    highSpeedStreakSec: 0,
    arrivalRestaurant: null,
    arrivalCustomer: null,
    activeOrderCount: ot.stack,
    acceptedAddons: 0,
    rejectedAddons: 0,
    events: [
      {
        id: uid(),
        type: "started",
        at: started.toISOString(),
        gps: point(gps),
        note: ot.label,
      },
    ],
    analytics: null,
  };
}

/** Reject stacked offer while en route / waiting — stay on same screen. */
export function rejectNewOrder(delivery, { gps, reason } = {}) {
  if (!delivery || delivery.status !== "active") return delivery;
  return {
    ...delivery,
    rejectedAddons: Number(delivery.rejectedAddons || 0) + 1,
    events: pushEvent(delivery, "rejected_order", { gps, note: reason || null }),
  };
}

/** Accept stacked offer — increase active order count. */
export function acceptNewOrder(delivery, { gps } = {}) {
  if (!delivery || delivery.status !== "active") return delivery;
  return {
    ...delivery,
    activeOrderCount: Number(delivery.activeOrderCount || 1) + 1,
    acceptedAddons: Number(delivery.acceptedAddons || 0) + 1,
    events: pushEvent(delivery, "accepted_order", { gps }),
  };
}

/** Arrive at restaurant: pause primary + miles, start secondary. */
export function arriveAtRestaurant(delivery, { gps, now = Date.now() } = {}) {
  if (!delivery || delivery.status !== "active") return delivery;
  if (delivery.screen !== DD_SCREENS.TO_RESTAURANT) return delivery;
  return {
    ...delivery,
    screen: DD_SCREENS.AT_RESTAURANT,
    primaryTimer: pauseTimer(delivery.primaryTimer, now),
    secondaryTimer: startTimer(now),
    milesTracking: false,
    highSpeedStreakSec: 0,
    arrivalRestaurant: {
      at: new Date(now).toISOString(),
      miles: Number(delivery.miles || 0),
      gps: point(gps),
    },
    events: pushEvent(delivery, "arrived_restaurant", { gps, at: new Date(now).toISOString() }),
  };
}

/**
 * Auto or manual depart restaurant: pause secondary, resume primary + miles.
 * Used when GPS speed > 15 mph for 10s.
 */
export function departRestaurant(delivery, { gps, now = Date.now(), auto = true } = {}) {
  if (!delivery || delivery.status !== "active") return delivery;
  if (delivery.screen !== DD_SCREENS.AT_RESTAURANT) return delivery;
  return {
    ...delivery,
    screen: DD_SCREENS.TO_CUSTOMER,
    secondaryTimer: pauseTimer(delivery.secondaryTimer, now),
    primaryTimer: resumeTimer(delivery.primaryTimer, now),
    milesTracking: true,
    highSpeedStreakSec: 0,
    events: pushEvent(delivery, auto ? "auto_departed_restaurant" : "departed_restaurant", {
      gps,
      at: new Date(now).toISOString(),
    }),
  };
}

/** Arrive at customer: pause primary + miles, start completion timer. */
export function arriveAtCustomer(delivery, { gps, now = Date.now() } = {}) {
  if (!delivery || delivery.status !== "active") return delivery;
  if (delivery.screen !== DD_SCREENS.TO_CUSTOMER) return delivery;
  return {
    ...delivery,
    screen: DD_SCREENS.AT_CUSTOMER,
    primaryTimer: pauseTimer(delivery.primaryTimer, now),
    completionTimer: startTimer(now),
    milesTracking: false,
    arrivalCustomer: {
      at: new Date(now).toISOString(),
      miles: Number(delivery.miles || 0),
      gps: point(gps),
    },
    events: pushEvent(delivery, "arrived_customer", { gps, at: new Date(now).toISOString() }),
  };
}

/**
 * Update high-speed streak while at restaurant.
 * Returns { delivery, departed: boolean }.
 */
export function tickRestaurantSpeed(delivery, speedMph, dtSec = 1, { gps, now = Date.now() } = {}) {
  if (!delivery || delivery.screen !== DD_SCREENS.AT_RESTAURANT) {
    return { delivery, departed: false };
  }
  const speed = Number(speedMph) || 0;
  let streak = Number(delivery.highSpeedStreakSec || 0);
  if (speed > DD_DEPART_SPEED_MPH) {
    streak += Math.max(0, Number(dtSec) || 0);
  } else {
    streak = 0;
  }
  let next = { ...delivery, highSpeedStreakSec: streak };
  if (streak >= DD_DEPART_HOLD_SEC) {
    next = departRestaurant(next, { gps, now, auto: true });
    return { delivery: next, departed: true };
  }
  return { delivery: next, departed: false };
}

/** Apply GPS miles (never decrease). */
export function applyMiles(delivery, miles) {
  if (!delivery || !delivery.milesTracking) return delivery;
  const next = Math.max(Number(delivery.miles || 0), Number(miles) || 0);
  if (next === Number(delivery.miles || 0)) return delivery;
  return { ...delivery, miles: Math.round(next * 100) / 100 };
}

export function setGpsAvailable(delivery, available) {
  if (!delivery) return delivery;
  if (Boolean(delivery.gpsAvailable) === Boolean(available)) return delivery;
  return {
    ...delivery,
    gpsAvailable: Boolean(available),
    events: pushEvent(delivery, available ? "gps_restored" : "gps_lost"),
  };
}

export function cancelDelivery(delivery, { gps, now = Date.now() } = {}) {
  if (!delivery || delivery.status !== "active") return delivery;
  const stopped = {
    ...delivery,
    status: "cancelled",
    screen: DD_SCREENS.START,
    endedAt: new Date(now).toISOString(),
    primaryTimer: stopTimer(delivery.primaryTimer, now),
    secondaryTimer: stopTimer(delivery.secondaryTimer, now),
    completionTimer: stopTimer(delivery.completionTimer, now),
    milesTracking: false,
    events: pushEvent(delivery, "cancelled", { gps, at: new Date(now).toISOString() }),
  };
  stopped.analytics = computeAnalytics(stopped, { now });
  return stopped;
}

export function completeDelivery(delivery, { gps, payoutUsd = null, now = Date.now() } = {}) {
  if (!delivery || delivery.status !== "active") return delivery;
  if (delivery.screen !== DD_SCREENS.AT_CUSTOMER) return delivery;
  const stopped = {
    ...delivery,
    status: "completed",
    screen: DD_SCREENS.START,
    endedAt: new Date(now).toISOString(),
    primaryTimer: stopTimer(delivery.primaryTimer, now),
    secondaryTimer: stopTimer(delivery.secondaryTimer, now),
    completionTimer: stopTimer(delivery.completionTimer, now),
    milesTracking: false,
    payoutUsd: payoutUsd != null ? Number(payoutUsd) : null,
    events: pushEvent(delivery, "delivered", { gps, at: new Date(now).toISOString() }),
  };
  stopped.analytics = computeAnalytics(stopped, { now });
  return stopped;
}

/**
 * Detailed analytics for a finished (completed or cancelled) delivery.
 */
export function computeAnalytics(delivery, { now = Date.now() } = {}) {
  if (!delivery) return null;
  const endMs = delivery.endedAt ? new Date(delivery.endedAt).getTime() : now;
  const startMs = new Date(delivery.startedAt).getTime();

  const restaurantWaitMs = timerElapsedMs(delivery.secondaryTimer, endMs);
  const customerWaitMs = timerElapsedMs(delivery.completionTimer, endMs);

  const arrivedR = delivery.arrivalRestaurant
    ? new Date(delivery.arrivalRestaurant.at).getTime()
    : null;
  const arrivedC = delivery.arrivalCustomer
    ? new Date(delivery.arrivalCustomer.at).getTime()
    : null;

  const timeToRestaurantMs = arrivedR != null ? Math.max(0, arrivedR - startMs) : 0;
  // Driving to customer ≈ wall from restaurant arrival to customer arrival minus wait already in secondary
  // Prefer: primary elapsed minus restaurant wait portions while primary was paused
  const primaryMs = timerElapsedMs(delivery.primaryTimer, endMs);
  const timeToCustomerMs =
    arrivedR != null && arrivedC != null
      ? Math.max(0, arrivedC - arrivedR - restaurantWaitMs)
      : Math.max(0, primaryMs - timeToRestaurantMs);

  const totalDurationMs = Math.max(0, endMs - startMs);
  const totalMiles = Number(delivery.miles || 0);
  const drivingMs = Math.max(0, timeToRestaurantMs + timeToCustomerMs);
  const idleMs = restaurantWaitMs + customerWaitMs;
  const avgSpeedMph =
    drivingMs > 0 ? Math.round((totalMiles / (drivingMs / 3600)) * 10) / 10 : 0;

  const accepted = Number(delivery.acceptedAddons || 0);
  const rejected = Number(delivery.rejectedAddons || 0);
  const offerDecisions = accepted + rejected;
  const completionRate =
    delivery.status === "completed"
      ? 1
      : delivery.status === "cancelled"
        ? 0
        : offerDecisions > 0
          ? accepted / offerDecisions
          : null;

  const payout = delivery.payoutUsd != null ? Number(delivery.payoutUsd) : null;
  const hours = totalDurationMs / 3600000;
  const dollarsPerMile =
    payout != null && totalMiles > 0 ? Math.round((payout / totalMiles) * 100) / 100 : null;
  const dollarsPerHour =
    payout != null && hours > 0 ? Math.round((payout / hours) * 100) / 100 : null;
  const estimatedProfit = payout; // payout-only until cost model patched in

  const rush = classifyRushWindow(new Date(startMs));

  return {
    platform: "DoorDash",
    orderType: delivery.orderTypeLabel,
    orderTypeId: delivery.orderTypeId,
    status: delivery.status,
    startTime: delivery.startedAt,
    endTime: delivery.endedAt,
    dayOfWeek: delivery.dayOfWeek,
    rushPeriod: rush?.label || rush?.id || null,
    timeToRestaurantSec: Math.round(timeToRestaurantMs / 1000),
    restaurantWaitSec: Math.round(restaurantWaitMs / 1000),
    timeToCustomerSec: Math.round(timeToCustomerMs / 1000),
    customerWaitSec: Math.round(customerWaitMs / 1000),
    drivingTimeSec: Math.round(drivingMs / 1000),
    idleTimeSec: Math.round(idleMs / 1000),
    totalDurationSec: Math.round(totalDurationMs / 1000),
    totalMiles,
    averageSpeedMph: avgSpeedMph,
    stops: [
      delivery.arrivalRestaurant ? "restaurant" : null,
      delivery.arrivalCustomer ? "customer" : null,
    ].filter(Boolean),
    activeOrderCount: delivery.activeOrderCount,
    acceptedAddons: accepted,
    rejectedAddons: rejected,
    completionRate,
    estimatedProfit,
    dollarsPerMile,
    dollarsPerHour,
    weather: null,
    trafficEstimate: null,
  };
}

/* ── Persistence ─────────────────────────────────────────── */

export function readActiveDelivery(userId) {
  return readLocal(DD_PREFIX, userId, DD_ACTIVE_SUFFIX, null);
}

export function writeActiveDelivery(userId, delivery, opts = {}) {
  const { soft = false, silent = false, departed = false } = opts;
  if (!delivery || delivery.status !== "active") {
    writeLocal(DD_PREFIX, userId, DD_ACTIVE_SUFFIX, null);
  } else {
    writeLocal(DD_PREFIX, userId, DD_ACTIVE_SUFFIX, delivery);
  }
  if (!silent) emitDoorDashChanged(userId, { soft, departed });
  return delivery;
}

export function clearActiveDelivery(userId, opts = {}) {
  writeLocal(DD_PREFIX, userId, DD_ACTIVE_SUFFIX, null);
  if (!opts.silent) emitDoorDashChanged(userId, opts);
}

export function readDoorDashHistory(userId) {
  const list = readLocal(DD_PREFIX, userId, DD_HISTORY_SUFFIX, []);
  return Array.isArray(list) ? list : [];
}

export function appendDoorDashHistory(userId, delivery) {
  if (!delivery || delivery.status === "active") return;
  const prev = readDoorDashHistory(userId);
  const next = [delivery, ...prev.filter((d) => d.id !== delivery.id)].slice(0, DD_HISTORY_MAX);
  writeLocal(DD_PREFIX, userId, DD_HISTORY_SUFFIX, next);
  emitDoorDashChanged(userId);
  return next;
}

export function saveDeliverySnapshot(userId, delivery, opts = {}) {
  if (!delivery) {
    clearActiveDelivery(userId, opts);
    return null;
  }
  if (delivery.status === "active") {
    writeActiveDelivery(userId, delivery, opts);
    return delivery;
  }
  clearActiveDelivery(userId, { silent: true });
  appendDoorDashHistory(userId, delivery);
  return delivery;
}

export function emitDoorDashChanged(userId, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DD_EVENT, {
      detail: { userId, at: Date.now(), ...detail },
    })
  );
}

/** Roll-up for start-screen performance strip. */
export function summarizeDoorDashPerformance(history = []) {
  const list = Array.isArray(history) ? history : [];
  const completed = list.filter((d) => d.status === "completed");
  const cancelled = list.filter((d) => d.status === "cancelled");
  const n = list.length;
  const waits = completed
    .map((d) => Number(d.analytics?.restaurantWaitSec))
    .filter((v) => Number.isFinite(v));
  const miles = completed
    .map((d) => Number(d.analytics?.totalMiles ?? d.miles))
    .filter((v) => Number.isFinite(v) && v >= 0);
  const durations = completed
    .map((d) => Number(d.analytics?.totalDurationSec))
    .filter((v) => Number.isFinite(v) && v > 0);
  const accepted = list.reduce((s, d) => s + Number(d.analytics?.acceptedAddons ?? d.acceptedAddons ?? 0), 0);
  const rejected = list.reduce((s, d) => s + Number(d.analytics?.rejectedAddons ?? d.rejectedAddons ?? 0), 0);
  const avg = (arr) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
  return {
    totalRuns: n,
    completed: completed.length,
    cancelled: cancelled.length,
    completionRate: n ? Math.round((completed.length / n) * 100) : null,
    avgRestaurantWaitSec: avg(waits),
    avgMiles: avg(miles),
    avgDurationSec: avg(durations) != null ? Math.round(avg(durations)) : null,
    acceptedAddons: accepted,
    rejectedAddons: rejected,
    stackSelectivity:
      accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 100) : null,
  };
}

export function formatCompactDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Live display snapshot for UI (timers as H:M:S). */
export function liveSnapshot(delivery, now = Date.now()) {
  if (!delivery) {
    return { screen: DD_SCREENS.START, delivery: null, stage: DD_STAGE_META[DD_SCREENS.START] };
  }
  const stage = DD_STAGE_META[delivery.screen] || DD_STAGE_META[DD_SCREENS.START];
  return {
    screen: delivery.screen,
    delivery,
    stage,
    primaryHms: formatTimerHms(delivery.primaryTimer, now),
    secondaryHms: formatTimerHms(delivery.secondaryTimer, now),
    completionHms: formatTimerHms(delivery.completionTimer, now),
    miles: Number(delivery.miles || 0),
    gpsAvailable: delivery.gpsAvailable !== false,
    orderTypeLabel: delivery.orderTypeLabel,
    activeOrderCount: delivery.activeOrderCount,
    highSpeedStreakSec: Number(delivery.highSpeedStreakSec || 0),
  };
}
