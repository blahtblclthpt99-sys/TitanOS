/**
 * Driver Hub persistence + session helpers.
 *
 * Owns local session/prefs/telemetry storage for the live shift surface.
 * Prefer `driverOs/workflowEngine` for event names; prefer `driverActivity/*`
 * for GPS, DoorDash, and intelligence math — keep this module as Hub glue.
 */
import { api } from "@/api/apiClient";
import { listEquipment } from "@/lib/equipmentApi";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { todayISO } from "@/lib/date-utils";
import {
  IRS_MILEAGE_RATE_USD,
  calcFuelCost,
  estimateShiftEarnings,
  parseMilesInput,
  summarizeProfitGrowth,
} from "@/lib/driverHubMath";
import { syncSessionLegsToJournal } from "@/lib/driverActivity/tripJournal";
import { generateShiftDigest } from "@/lib/driverActivity/analyticsDigest.js";

export {
  IRS_MILEAGE_RATE_USD,
  calcFuelCost,
  estimateShiftEarnings,
  parseMilesInput,
  summarizeRecordedShifts,
} from "@/lib/driverHubMath";

export { summarizeProfitGrowth } from "@/lib/driverHubMath";

const PREFIX = "titanos_driver";
const SESSION_KEY = "session";
const STOPS_KEY = "stops";
const PREFS_KEY = "prefs";

/** Notify UI / keep-alive that session or telemetry changed (survives refresh via localStorage). */
export function emitDriverSessionChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event("titanos-driver-session"));
  } catch {
    /* ignore */
  }
}

/** Approximate USD/gal by US ZIP first digit (fallback when no live API). */
const ZIP_GAS_USD = {
  0: 3.45,
  1: 3.55,
  2: 3.35,
  3: 3.2,
  4: 3.25,
  5: 3.15,
  6: 3.3,
  7: 3.05,
  8: 3.4,
  9: 4.55,
};

const FX_TO_USD = {
  USD: 1,
  CAD: 0.73,
  MXN: 0.058,
  EUR: 1.08,
  GBP: 1.27,
  AUD: 0.65,
  JPY: 0.0067,
  BRL: 0.18,
};

export function readPrefs(userId) {
  return readLocal(PREFIX, userId, PREFS_KEY, {
    currency: "USD",
    city: "",
    zip: "",
    lat: null,
    lng: null,
    mpg: null,
    connectedApps: [],
    equipmentId: null,
    mode: "driving", // "driving" | "riding"
    requestingRide: false,
    /** Auto GPS miles/stops only while a work session is active */
    autoTrack: true,
    /** Stationary seconds before confirming a delivery/haul stop */
    stopConfirmSec: 90,
    /** Acknowledge location privacy notice */
    locationPrivacyAck: false,
    /** Opt-in: start a work session when sustained motion is detected while off-shift */
    autoStartOnMotion: false,
  });
}

export function savePrefs(userId, prefs) {
  writeLocal(PREFIX, userId, PREFS_KEY, prefs);
  emitDriverSessionChanged();
  return prefs;
}

export function readSession(userId) {
  return readLocal(PREFIX, userId, SESSION_KEY, null);
}

export function readStops(userId) {
  const raw = readLocal(PREFIX, userId, STOPS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export async function listDriverVehicles(userId) {
  const rows = await listEquipment(userId);
  return (rows || []).filter((r) =>
    /vehicle|car|truck|van|suv|bike|motorcycle/i.test(String(r.category || r.name || ""))
  );
}

export function estimateGasPriceUsd(zip = "") {
  const digit = String(zip || "").replace(/\D/g, "")[0];
  return ZIP_GAS_USD[digit] ?? 3.45;
}

export function convertFromUsd(amountUsd, currency = "USD") {
  const rate = FX_TO_USD[currency] || 1;
  // FX_TO_USD is currency→USD; invert for display in local currency
  const local = amountUsd / rate;
  return Math.round(local * 100) / 100;
}

export function currencySymbol(currency = "USD") {
  const map = { USD: "$", CAD: "C$", MXN: "MX$", EUR: "€", GBP: "£", AUD: "A$", JPY: "¥", BRL: "R$" };
  return map[currency] || `${currency} `;
}

/** Rough MPG from vehicle category/name when not set. */
export function estimateMpg(vehicle) {
  if (!vehicle) return 25;
  const text = `${vehicle.category || ""} ${vehicle.name || ""} ${vehicle.make || ""} ${vehicle.brand || ""} ${vehicle.model || ""}`.toLowerCase();
  if (/hybrid|prius|ioniq|bolt/.test(text)) return 48;
  if (/electric|ev|tesla|leaf|id\.4|cybertruck/.test(text)) return 100;
  if (/truck|sierra|silverado|f-150|tundra|tacoma|ram|gladiator|canyon|ranger/.test(text)) return 18;
  if (/suv|tahoe|suburban|yukon|expedition|sequoia|armada/.test(text)) return 19;
  if (/van|transit|sprinter|promaster|odyssey|sienna|pacifica/.test(text)) return 18;
  if (/bike|scooter|motorcycle/.test(text)) return 55;
  return 26;
}

/**
 * Time-of-day helpers for hotspot ranking.
 * Buckets: morning 5–10, lunch 10–14, afternoon 14–17, dinner 17–21, late 21–5
 */
export function getDayPart(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 10) return "morning";
  if (h >= 10 && h < 14) return "lunch";
  if (h >= 14 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "dinner";
  return "late";
}

/** Representative hour for previewing a day-part on the map. */
export function hourForDayPart(part) {
  return { morning: 8, lunch: 12, afternoon: 15, dinner: 18, late: 22 }[part] ?? new Date().getHours();
}

export function dayPartLabel(part) {
  return (
    {
      morning: "Morning (5am–10am)",
      lunch: "Lunch (10am–2pm)",
      afternoon: "Afternoon (2pm–5pm)",
      dinner: "Dinner (5pm–9pm)",
      late: "Late night (9pm–5am)",
    }[part] || part
  );
}

function heatForNow(spot, hour) {
  const windows = spot.windows || [];
  let best = spot.baseHeat ?? 0.4;
  for (const w of windows) {
    const wrap = w.start > w.end;
    const inWindow = wrap ? hour >= w.start || hour < w.end : hour >= w.start && hour < w.end;
    if (inWindow) best = Math.max(best, w.heat);
  }
  return Math.min(1, best);
}

/**
 * Rich hotspot set near lat/lng with timed windows + tips.
 * mode: "driving" | "riding"
 */
export function buildHotspots({ lat, lng, city, mode = "driving", now = new Date(), previewPart = null }) {
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  if (!hasCoords) return [];
  const baseLat = Number(lat);
  const baseLng = Number(lng);
  const label = city || "your area";
  const riding = mode === "riding";
  const hour = previewPart ? hourForDayPart(previewPart) : now.getHours();
  const part = previewPart || getDayPart(now);

  const raw = [
    {
      id: "h1",
      name: `${label} Restaurant Row`,
      short: "Food strip",
      kind: "food",
      color: "#ef4444",
      baseHeat: 0.45,
      lat: baseLat + 0.011,
      lng: baseLng + 0.007,
      windows: [
        { start: 11, end: 14, heat: 0.75 },
        { start: 17, end: 21, heat: 0.98 },
        { start: 21, end: 23, heat: 0.7 },
      ],
      when: "Best 11am–2pm & 5–9pm",
      tip: riding
        ? "Stand near restaurant curb cuts after 5pm — short waits."
        : "Stack dinner deliveries here 5–9pm; lunch is solid too.",
    },
    {
      id: "h2",
      name: "Downtown core",
      short: "Downtown",
      kind: "downtown",
      color: "#f59e0b",
      baseHeat: 0.5,
      lat: baseLat + 0.003,
      lng: baseLng - 0.005,
      windows: [
        { start: 7, end: 10, heat: 0.8 },
        { start: 11, end: 14, heat: 0.85 },
        { start: 17, end: 21, heat: 0.9 },
        { start: 21, end: 2, heat: 0.88 },
      ],
      when: "Commute + lunch + nightlife",
      tip: riding
        ? "Office towers = morning/evening surge; bars after 9pm."
        : "Short hops all day; nightlife surge after 9pm.",
    },
    {
      id: "h3",
      name: "Airport / transit hub",
      short: "Airport",
      kind: "transit",
      color: "#3b82f6",
      baseHeat: 0.55,
      lat: baseLat - 0.02,
      lng: baseLng + 0.024,
      windows: [
        { start: 5, end: 9, heat: 0.95 },
        { start: 16, end: 20, heat: 0.9 },
        { start: 21, end: 1, heat: 0.75 },
      ],
      when: "Best 5–9am & 4–8pm",
      tip: riding
        ? "Arrivals queues move fastest early morning and evening."
        : "Chase flight banks early AM & evening; longer trips.",
    },
    {
      id: "h4",
      name: "Campus / stadium",
      short: "Stadium",
      kind: "events",
      color: "#a855f7",
      baseHeat: 0.35,
      lat: baseLat + 0.019,
      lng: baseLng - 0.014,
      windows: [
        { start: 11, end: 14, heat: 0.55 },
        { start: 17, end: 23, heat: 0.92 },
      ],
      when: "Event nights 5–11pm",
      tip: riding
        ? "Wait at exits 15 min before event end — fast matches."
        : "Pre-position before kickoff/let-out; huge spikes.",
    },
    {
      id: "h5",
      name: "Suburban strip malls",
      short: "Strip malls",
      kind: "suburban",
      color: "#22c55e",
      baseHeat: 0.5,
      lat: baseLat - 0.012,
      lng: baseLng - 0.018,
      windows: [
        { start: 10, end: 14, heat: 0.7 },
        { start: 17, end: 21, heat: 0.78 },
      ],
      when: "Steady 10am–9pm",
      tip: riding
        ? "Grocery exits and big-box doors are reliable midday."
        : "Grocery + fast food all afternoon; less surge, steady pay.",
    },
    {
      id: "h6",
      name: "Hospital / medical",
      short: "Hospitals",
      kind: "medical",
      color: "#06b6d4",
      baseHeat: 0.55,
      lat: baseLat + 0.007,
      lng: baseLng + 0.016,
      windows: [
        { start: 7, end: 11, heat: 0.82 },
        { start: 14, end: 18, heat: 0.75 },
      ],
      when: "Best 7–11am & 2–6pm",
      tip: riding
        ? "Main entrance / patient pickup loops daytime."
        : "Shift changes = rides; quieter late night.",
    },
    {
      id: "h7",
      name: "Hotel corridor",
      short: "Hotels",
      kind: "hotels",
      color: "#ec4899",
      baseHeat: 0.4,
      lat: baseLat + 0.001,
      lng: baseLng + 0.012,
      windows: [
        { start: 6, end: 10, heat: 0.88 },
        { start: 15, end: 19, heat: 0.7 },
        { start: 21, end: 1, heat: 0.8 },
      ],
      when: "Check-out 6–10am · nights",
      tip: riding
        ? "Lobby curb 6–10am for airport runs."
        : "Morning airport runs; late check-ins after 9pm.",
    },
    {
      id: "h8",
      name: "Nightlife / bars",
      short: "Nightlife",
      kind: "nightlife",
      color: "#f43f5e",
      baseHeat: 0.25,
      lat: baseLat - 0.004,
      lng: baseLng - 0.01,
      windows: [
        { start: 20, end: 3, heat: 0.97 },
      ],
      when: "Peak 8pm–3am",
      tip: riding
        ? "After 10pm is fastest for matches — wait on side streets."
        : "Fri/Sat goldmine after 10pm; short busy trips.",
    },
    {
      id: "h9",
      name: "Grocery / big-box",
      short: "Grocery",
      kind: "grocery",
      color: "#84cc16",
      baseHeat: 0.48,
      lat: baseLat - 0.015,
      lng: baseLng + 0.006,
      windows: [
        { start: 9, end: 12, heat: 0.72 },
        { start: 16, end: 20, heat: 0.85 },
      ],
      when: "Best 4–8pm",
      tip: riding
        ? "Curbside pickup spots after work hours."
        : "Instacart/DoorDash peak after work 4–8pm.",
    },
    {
      id: "h10",
      name: "Office parks",
      short: "Offices",
      kind: "office",
      color: "#64748b",
      baseHeat: 0.3,
      lat: baseLat + 0.014,
      lng: baseLng + 0.02,
      windows: [
        { start: 7, end: 10, heat: 0.9 },
        { start: 16, end: 19, heat: 0.86 },
      ],
      when: "Commute 7–10am & 4–7pm",
      tip: riding
        ? "Building exits at shift start/end."
        : "Morning drop-offs and evening pickups; dead midday.",
    },
    {
      id: "h11",
      name: "Mall / retail plaza",
      short: "Mall",
      kind: "retail",
      color: "#14b8a6",
      baseHeat: 0.42,
      lat: baseLat - 0.008,
      lng: baseLng + 0.015,
      windows: [
        { start: 11, end: 15, heat: 0.7 },
        { start: 17, end: 21, heat: 0.8 },
      ],
      when: "Weekends + evenings",
      tip: riding
        ? "Main entrance and food court doors."
        : "Weekend afternoons and dinner hours are strongest.",
    },
    {
      id: "h12",
      name: "University gates",
      short: "Campus",
      kind: "campus",
      color: "#8b5cf6",
      baseHeat: 0.4,
      lat: baseLat + 0.016,
      lng: baseLng - 0.008,
      windows: [
        { start: 8, end: 11, heat: 0.75 },
        { start: 15, end: 18, heat: 0.7 },
        { start: 21, end: 1, heat: 0.85 },
      ],
      when: "Class changes + late night",
      tip: riding
        ? "Main gates between classes; late-night dorm runs."
        : "Class change windows and weekend nights.",
    },
    {
      id: "h13",
      name: "Gas / convenience cluster",
      short: "C-stores",
      kind: "cstore",
      color: "#eab308",
      baseHeat: 0.38,
      lat: baseLat - 0.006,
      lng: baseLng - 0.022,
      windows: [
        { start: 6, end: 9, heat: 0.65 },
        { start: 21, end: 2, heat: 0.78 },
      ],
      when: "Early AM & late night",
      tip: riding
        ? "Quick late-night pickups near 24hr stores."
        : "Snack runs late; top up gas while waiting.",
    },
    {
      id: "h14",
      name: "Warehouse / industrial",
      short: "Industrial",
      kind: "industrial",
      color: "#78716c",
      baseHeat: 0.28,
      lat: baseLat - 0.022,
      lng: baseLng - 0.008,
      windows: [
        { start: 5, end: 8, heat: 0.8 },
        { start: 14, end: 17, heat: 0.7 },
      ],
      when: "Shift changes 5–8am & 2–5pm",
      tip: riding
        ? "Gate / parking lot exits at shift change."
        : "Shift changes only — skip midday.",
    },
  ];

  return raw
    .map((spot) => {
      const heat = heatForNow(spot, hour);
      const hotNow = heat >= 0.75;
      return {
        ...spot,
        heat,
        hotNow,
        dayPart: part,
        nowTip: hotNow
          ? `NOW · ${spot.when}`
          : `${dayPartLabel(part)} is quieter here · try ${spot.when}`,
      };
    })
    .sort((a, b) => b.heat - a.heat);
}

export function topHotspotsNow(hotspots, limit = 3) {
  return [...(hotspots || [])].sort((a, b) => b.heat - a.heat).slice(0, limit);
}

export function openStreetMapEmbed(lat, lng, zoom = 12) {
  const b = 0.045;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - b}%2C${lat - b}%2C${lng + b}%2C${lat + b}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export async function startDrivingSession(user, prefs) {
  const session = {
    id: uid(),
    user_id: user.id,
    started_at: new Date().toISOString(),
    ended_at: null,
    active: true,
    paused: false,
    paused_at: null,
    pause_accum_sec: 0,
    city: prefs.city || "",
    zip: prefs.zip || "",
    lat: prefs.lat,
    lng: prefs.lng,
    equipment_id: prefs.equipmentId || null,
    currency: prefs.currency || "USD",
    miles: 0,
    auto_miles: 0,
    miles_source: prefs.autoTrack === false ? "manual" : "gps",
    stops: 0,
    apps: prefs.connectedApps || [],
    drive_sec: 0,
    idle_sec: 0,
    max_speed_mph: 0,
    avg_speed_mph: 0,
    stop_phase: "moving",
    auto_track: prefs.autoTrack !== false,
  };
  writeLocal(PREFIX, user.id, SESSION_KEY, session);
  writeLocal(PREFIX, user.id, STOPS_KEY, []);
  emitDriverSessionChanged();
  return session;
}

export function pauseDrivingSession(userId) {
  const session = readSession(userId);
  if (!session?.active || session.paused) return session;
  const next = {
    ...session,
    paused: true,
    paused_at: new Date().toISOString(),
  };
  writeLocal(PREFIX, userId, SESSION_KEY, next);
  emitDriverSessionChanged();
  return next;
}

export function resumeDrivingSession(userId) {
  const session = readSession(userId);
  if (!session?.active || !session.paused) return session;
  const pausedMs = session.paused_at
    ? Math.max(0, Date.now() - new Date(session.paused_at).getTime())
    : 0;
  const next = {
    ...session,
    paused: false,
    paused_at: null,
    pause_accum_sec: Number(session.pause_accum_sec || 0) + Math.round(pausedMs / 1000),
  };
  writeLocal(PREFIX, userId, SESSION_KEY, next);
  emitDriverSessionChanged();
  return next;
}

/** Patch live telemetry from the Activity Engine (GPS). */
export function patchSessionTelemetry(userId, patch = {}) {
  const session = readSession(userId);
  if (!session?.active) return null;
  const autoMiles = patch.auto_miles != null ? Number(patch.auto_miles) : Number(session.auto_miles || 0);
  const manualOverride = session.miles_source === "manual";
  const miles = manualOverride
    ? Number(session.miles || 0)
    : Math.max(Number(session.miles || 0), autoMiles);

  // Never let a remounted tracker (starting at 0) wipe saved drive/idle totals
  const driveSec =
    patch.drive_sec != null
      ? Math.max(Number(session.drive_sec || 0), Number(patch.drive_sec) || 0)
      : Number(session.drive_sec || 0);
  const idleSec =
    patch.idle_sec != null
      ? Math.max(Number(session.idle_sec || 0), Number(patch.idle_sec) || 0)
      : Number(session.idle_sec || 0);

  const next = {
    ...session,
    ...patch,
    auto_miles: autoMiles,
    miles,
    drive_sec: driveSec,
    idle_sec: idleSec,
    max_speed_mph: Math.max(
      Number(session.max_speed_mph || 0),
      Number(patch.max_speed_mph != null ? patch.max_speed_mph : session.max_speed_mph || 0)
    ),
    miles_source: manualOverride ? "manual" : patch.miles_source || session.miles_source || "gps",
    telemetry_at: new Date().toISOString(),
  };
  writeLocal(PREFIX, userId, SESSION_KEY, next);
  emitDriverSessionChanged();
  return next;
}

export async function stopDrivingSession(userId, snapshot = {}) {
  const session = readSession(userId);
  if (!session) return null;
  const stops = readStops(userId);
  const miles = Number(
    snapshot.miles != null ? snapshot.miles : session.miles || 0
  );
  const elapsedSec =
    snapshot.elapsedSec != null
      ? Number(snapshot.elapsedSec)
      : Math.max(
          0,
          Math.round(
            (Date.now() - new Date(session.started_at || Date.now()).getTime()) / 1000
          )
        );
  const jobsCompleted =
    snapshot.jobsCompleted != null
      ? Number(snapshot.jobsCompleted)
      : stops.filter((s) => s.ended_at).length;
  const ended = {
    ...session,
    active: false,
    paused: false,
    ended_at: new Date().toISOString(),
    stops: stops.length,
    stops_detail: stops,
    miles,
    elapsed_sec: elapsedSec,
    hours: snapshot.hours != null ? Number(snapshot.hours) : Math.round((elapsedSec / 3600) * 100) / 100,
    jobs_completed: jobsCompleted,
    drive_sec: Number(snapshot.driveSec ?? session.drive_sec ?? 0),
    idle_sec: Number(snapshot.idleSec ?? session.idle_sec ?? 0),
    max_speed_mph: Number(snapshot.maxSpeedMph ?? session.max_speed_mph ?? 0),
    avg_speed_mph: Number(snapshot.avgSpeedMph ?? session.avg_speed_mph ?? 0),
    auto_miles: Number(snapshot.autoMiles ?? session.auto_miles ?? 0),
    miles_source: snapshot.milesSource || session.miles_source || "manual",
    // Legacy earnings fields kept for old history rows; UI no longer surfaces estimates
    earnings_gross: Number(snapshot.earningsGross ?? 0),
    earnings_per_hour: Number(snapshot.earningsPerHour ?? 0),
    fuel_cost: Number(snapshot.fuelCost ?? 0),
    fuel_gallons: Number(snapshot.fuelGallons ?? 0),
    profit: Number(snapshot.profit ?? 0),
    tax_estimate: Number(snapshot.taxEstimate ?? 0),
    mpg: Number(snapshot.mpg ?? session.mpg ?? 0),
    currency: snapshot.currency || session.currency || "USD",
  };
  writeLocal(PREFIX, userId, SESSION_KEY, ended);
  const history = readLocal(PREFIX, userId, "history", []);
  writeLocal(PREFIX, userId, "history", [ended, ...history].slice(0, 90));
  try {
    syncSessionLegsToJournal(userId, ended, stops);
  } catch {
    /* journal is best-effort */
  }
  try {
    generateShiftDigest(userId, ended, stops, {
      history: readShiftHistory(userId),
    });
  } catch {
    /* digest is best-effort */
  }
  emitDriverSessionChanged();
  return ended;
}

function seededShiftHistory() {
  const now = new Date();
  const stamp = (daysAgo, hour = 8) => {
    const d = new Date(now);
    d.setHours(hour, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  return [
    {
      id: "seed-shift-1",
      started_at: stamp(86, 7),
      ended_at: stamp(86, 14),
      miles: 182,
      stops: 8,
      jobs_completed: 7,
      hours: 6.8,
      earnings_gross: 195,
      fuel_cost: 24.6,
      profit: 140,
      tax_estimate: 34.2,
      currency: "USD",
      drive_sec: 24480,
      idle_sec: 1200,
    },
    {
      id: "seed-shift-2",
      started_at: stamp(63, 8),
      ended_at: stamp(63, 15),
      miles: 208,
      stops: 10,
      jobs_completed: 8,
      hours: 7.4,
      earnings_gross: 212,
      fuel_cost: 26.8,
      profit: 152,
      tax_estimate: 36.7,
      currency: "USD",
      drive_sec: 26640,
      idle_sec: 1320,
    },
    {
      id: "seed-shift-3",
      started_at: stamp(41, 7),
      ended_at: stamp(41, 15),
      miles: 238,
      stops: 12,
      jobs_completed: 9,
      hours: 8.1,
      earnings_gross: 230,
      fuel_cost: 29.7,
      profit: 186,
      tax_estimate: 39.8,
      currency: "USD",
      drive_sec: 29160,
      idle_sec: 1440,
    },
    {
      id: "seed-shift-4",
      started_at: stamp(14, 6),
      ended_at: stamp(14, 15),
      miles: 264,
      stops: 13,
      jobs_completed: 12,
      hours: 8.7,
      earnings_gross: 248,
      fuel_cost: 31.4,
      profit: 201,
      tax_estimate: 42.4,
      currency: "USD",
      drive_sec: 31320,
      idle_sec: 1560,
    },
  ];
}

export function readShiftHistory(userId) {
  const raw = readLocal(PREFIX, userId, "history", []);
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (!userId) return [];
  const seeded = seededShiftHistory();
  writeLocal(PREFIX, userId, "history", seeded);
  emitDriverSessionChanged();
  return seeded;
}

export function coachTip(mode, dayPart) {
  const driving = {
    morning: "Airport + hotel corridors first — early flight banks pay. Deny anything under your all-in $/mi floor.",
    lunch: "Restaurant row + downtown offices for stacked short trips that clear true cost per mile.",
    afternoon: "Position near hospitals and strip malls before dinner — skip scrap offers that drag your average.",
    dinner: "Food corridors 5–9pm — highest stack potential. Protect fuel + maint + tires + vehicle cost/mi.",
    late: "Nightlife and late grocery runs; keep gas topped off and deny long deadheads.",
  };
  const riding = {
    morning: "Hotel curb or transit hub for fastest morning matches.",
    lunch: "Downtown towers and restaurant strips have short waits.",
    afternoon: "Mall and hospital entrances are steady.",
    dinner: "Restaurant curbs after 5pm — busiest pickup windows.",
    late: "Nightlife districts after 10pm match fastest.",
  };
  const map = mode === "riding" ? riding : driving;
  return map[dayPart] || map.dinner;
}

export function addStop(userId, partial = {}) {
  const session = readSession(userId);
  if (!session?.active) return null;
  const stops = readStops(userId);
  // Chronological previous = oldest unfinished chain → last ended stop by time
  const ordered = [...stops].sort(
    (a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0)
  );
  const prevEnded = [...ordered].reverse().find((s) => s.ended_at) || null;
  const now = Date.now();
  const betweenMs = prevEnded?.ended_at
    ? now - new Date(prevEnded.ended_at).getTime()
    : session.started_at
      ? now - new Date(session.started_at).getTime()
      : null;

  const milesNow = Number(session.miles || 0);
  const driveNow = Number(session.drive_sec || 0);
  const prevMiles =
    prevEnded?.miles_at_departure != null
      ? Number(prevEnded.miles_at_departure)
      : prevEnded
        ? Number(prevEnded.miles_at_arrival || 0)
        : 0;
  const prevDrive =
    prevEnded?.drive_sec_at_departure != null
      ? Number(prevEnded.drive_sec_at_departure)
      : prevEnded
        ? Number(prevEnded.drive_sec_at_arrival || 0)
        : 0;

  const stop = {
    id: partial.id || uid(),
    started_at: partial.started_at || new Date().toISOString(),
    ended_at: null,
    duration_sec: 0,
    between_orders_sec:
      partial.between_orders_sec != null
        ? Number(partial.between_orders_sec)
        : betweenMs != null
          ? Math.round(betweenMs / 1000)
          : null,
    miles_delta:
      partial.miles_delta != null
        ? Number(partial.miles_delta)
        : Math.max(0, Math.round((milesNow - prevMiles) * 10) / 10),
    miles_at_arrival: partial.miles_at_arrival != null ? Number(partial.miles_at_arrival) : milesNow,
    drive_sec_at_arrival:
      partial.drive_sec_at_arrival != null ? Number(partial.drive_sec_at_arrival) : driveNow,
    drive_since_prev_sec:
      partial.drive_since_prev_sec != null
        ? Number(partial.drive_since_prev_sec)
        : Math.max(0, driveNow - prevDrive),
    miles_since_prev:
      partial.miles_since_prev != null
        ? Number(partial.miles_since_prev)
        : Math.max(0, Math.round((milesNow - prevMiles) * 10) / 10),
    note: partial.note || "",
    label: partial.label || "",
    app: partial.app || "",
    lat: partial.lat ?? null,
    lng: partial.lng ?? null,
    auto: Boolean(partial.auto),
  };
  writeLocal(PREFIX, userId, STOPS_KEY, [stop, ...stops]);
  const patched = { ...session, stops: stops.length + 1 };
  writeLocal(PREFIX, userId, SESSION_KEY, patched);
  return stop;
}

export function renameStop(userId, stopId, label) {
  const stops = readStops(userId);
  const next = stops.map((s) =>
    s.id === stopId ? { ...s, label: String(label || "").slice(0, 80), note: String(label || "").slice(0, 80) } : s
  );
  writeLocal(PREFIX, userId, STOPS_KEY, next);
  return next.find((s) => s.id === stopId);
}

export function endStop(userId, stopId) {
  const session = readSession(userId);
  const stops = readStops(userId);
  const milesNow = Number(session?.miles || 0);
  const driveNow = Number(session?.drive_sec || 0);
  const next = stops.map((s) => {
    if (s.id !== stopId || s.ended_at) return s;
    const ended = new Date().toISOString();
    const duration_sec = Math.max(1, Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000));
    return {
      ...s,
      ended_at: ended,
      duration_sec,
      miles_at_departure: milesNow,
      drive_sec_at_departure: driveNow,
    };
  });
  writeLocal(PREFIX, userId, STOPS_KEY, next);
  const endedStop = next.find((s) => s.id === stopId);
  try {
    if (session && endedStop) syncSessionLegsToJournal(userId, session, next);
  } catch {
    /* journal is best-effort */
  }
  return endedStop;
}

export function updateSessionMiles(userId, miles) {
  const session = readSession(userId);
  if (!session) return null;
  const parsed = parseMilesInput(miles);
  if (!parsed.ok) return { error: parsed.error, session };
  const next = {
    ...session,
    miles: parsed.miles,
    miles_source: "manual",
  };
  writeLocal(PREFIX, userId, SESSION_KEY, next);
  return next;
}

/**
 * Full shift dashboard metrics (miles, time, fuel, earnings, profit, tax estimate).
 */
export function computeShiftDashboard(session, stops, { mpg, gasPriceLocal, currency } = {}) {
  const base = sessionStats(session, stops);
  if (!base) return null;
  const fuel = calcFuelCost({
    miles: base.miles,
    mpg: mpg || 25,
    gasPriceLocal: gasPriceLocal || 0,
    currency: currency || "USD",
  });
  const earnings = estimateShiftEarnings({
    miles: base.miles,
    elapsedSec: base.elapsedSec,
    stops: base.stops,
  });
  const profit = Math.round((earnings.gross - fuel.cost) * 100) / 100;
  const taxEstimate = Math.round(base.miles * IRS_MILEAGE_RATE_USD * 100) / 100;
  return {
    ...base,
    mpg: Math.max(Number(mpg) || 25, 1),
    fuel,
    earnings,
    profit,
    taxEstimate,
    jobsCompleted: (Array.isArray(stops) ? stops : []).filter((s) => s.ended_at).length,
  };
}

/**
 * While driving is active (and on end), push/update mileage + fuel into Tax Center.
 * Reuses session.tax_trip_id / tax_expense_id so the toggle keeps one live tax row.
 */
export async function syncSessionToTax(user, session, { mpg, gasPriceLocal, currency, vehicleName }) {
  if (!session || !user?.id) return { ok: false };
  const miles = Number(session.miles || 0);
  if (miles <= 0) return { ok: false, reason: "no_miles" };

  const year = new Date(session.started_at || Date.now()).getFullYear();
  const fuel = calcFuelCost({ miles, mpg, gasPriceLocal, currency });
  const date = (session.started_at || todayISO()).slice(0, 10);
  const notes = `Auto-logged from Driver Hub${vehicleName ? ` · ${vehicleName}` : ""} · ${fuel.gallons} gal est · ${currencySymbol(currency)}${fuel.cost}${session.active ? " · in progress" : ""}`;
  const tripPayload = {
    date,
    purpose: "Rideshare / delivery driving",
    from_location: session.city || "Driver hub start",
    to_location: session.active ? "In progress" : "Driver hub end",
    miles,
    customer_name: "Driver Hub",
    notes,
    tax_year: year,
    created_by_id: user.id,
  };

  let trip = null;
  try {
    if (session.tax_trip_id) {
      trip = await api.entities.MileageTrip.update(session.tax_trip_id, tripPayload);
    } else {
      trip = await api.entities.MileageTrip.create(tripPayload);
    }
  } catch {
    const local = readLocal(PREFIX, user.id, "tax_trips", []);
    trip = session.tax_trip_id
      ? { id: session.tax_trip_id, ...tripPayload }
      : { id: uid(), created_at: new Date().toISOString(), ...tripPayload };
    const next = [trip, ...local.filter((t) => t.id !== trip.id)];
    writeLocal(PREFIX, user.id, "tax_trips", next);
  }

  let expense = null;
  if (fuel.cost > 0) {
    const expensePayload = {
      description: `Fuel · Driver Hub (${vehicleName || "vehicle"})`,
      vendor: "Fuel",
      amount: fuel.cost,
      date: (session.ended_at || session.started_at || todayISO()).slice(0, 10),
      category: "fuel",
      is_tax_deductible: true,
      business_use_percent: 100,
      notes: `Auto from Driver Hub · ${miles} mi · ~${fuel.gallons} gal @ ${currencySymbol(currency)}${gasPriceLocal}/${currency === "USD" ? "gal" : "unit"}`,
      created_by_id: user.id,
    };
    try {
      if (session.tax_expense_id) {
        expense = await api.entities.Expense.update(session.tax_expense_id, expensePayload);
      } else {
        expense = await api.entities.Expense.create(expensePayload);
      }
    } catch {
      /* optional */
    }
  }

  const patched = {
    ...session,
    tax_trip_id: trip?.id || session.tax_trip_id || null,
    tax_expense_id: expense?.id || session.tax_expense_id || null,
  };
  writeLocal(PREFIX, user.id, SESSION_KEY, patched);

  return { ok: true, trip, expense, fuel, session: patched };
}

export function sessionStats(session, stops) {
  if (!session) return null;
  const stopList = Array.isArray(stops) ? stops : [];
  const closed = stopList.filter((s) => s.ended_at);
  const avgStop =
    closed.length > 0
      ? Math.round(closed.reduce((s, x) => s + (x.duration_sec || 0), 0) / closed.length)
      : 0;
  const between = closed
    .map((s) => s.between_orders_sec)
    .filter((n) => typeof n === "number" && n >= 0);
  const avgBetween =
    between.length > 0 ? Math.round(between.reduce((a, b) => a + b, 0) / between.length) : null;
  const pauseExtra =
    session.paused && session.paused_at
      ? Math.round((Date.now() - new Date(session.paused_at).getTime()) / 1000)
      : 0;
  const pauseAccum = Number(session.pause_accum_sec || 0) + pauseExtra;
  const wallSec = Math.round(
    ((session.ended_at ? new Date(session.ended_at) : new Date()) - new Date(session.started_at)) /
      1000
  );
  const elapsedSec = Math.max(0, wallSec - pauseAccum);
  const driveSec = Number(session.drive_sec || 0);
  const idleSec = Number(session.idle_sec || 0);
  return {
    miles: Number(session.miles || 0),
    autoMiles: Number(session.auto_miles || 0),
    stops: stopList.length,
    avgStopSec: avgStop,
    avgBetweenSec: avgBetween,
    elapsedSec,
    driveSec,
    idleSec,
    maxSpeedMph: Number(session.max_speed_mph || 0),
    avgSpeedMph: Number(session.avg_speed_mph || 0),
    stopPhase: session.stop_phase || "moving",
    paused: Boolean(session.paused),
    milesSource: session.miles_source || "manual",
    active: Boolean(session.active),
  };
}

export function formatDuration(sec) {
  if (sec == null) return "—";
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}
