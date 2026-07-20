import { api } from "@/api/apiClient";
import { listEquipment } from "@/lib/equipmentApi";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { todayISO } from "@/lib/date-utils";

const PREFIX = "titanos_driver";
const SESSION_KEY = "session";
const STOPS_KEY = "stops";
const PREFS_KEY = "prefs";

export const DRIVER_APPS = [
  {
    id: "uber",
    name: "Uber",
    type: "rideshare",
    color: "#000000",
    deepLink: "uber://",
    web: "https://m.uber.com/ul/",
    store: "https://www.uber.com/us/en/drive/",
  },
  {
    id: "lyft",
    name: "Lyft",
    type: "rideshare",
    color: "#FF00BF",
    deepLink: "lyft://",
    web: "https://www.lyft.com/driver",
    store: "https://www.lyft.com/driver",
  },
  {
    id: "doordash",
    name: "DoorDash",
    type: "delivery",
    color: "#FF3008",
    deepLink: "doordash://",
    web: "https://www.doordash.com/dasher/login",
    store: "https://www.doordash.com/dasher/signup/",
  },
  {
    id: "ubereats",
    name: "Uber Eats",
    type: "delivery",
    color: "#06C167",
    deepLink: "ubereats://",
    web: "https://www.uber.com/us/en/deliver/",
    store: "https://www.uber.com/us/en/deliver/",
  },
  {
    id: "grubhub",
    name: "Grubhub",
    type: "delivery",
    color: "#FF8000",
    deepLink: "grubhubdriver://",
    web: "https://driver.grubhub.com/",
    store: "https://driver.grubhub.com/",
  },
  {
    id: "instacart",
    name: "Instacart",
    type: "delivery",
    color: "#0AAD0A",
    deepLink: "instacart-shopper://",
    web: "https://shoppers.instacart.com/",
    store: "https://shoppers.instacart.com/",
  },
];

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
  });
}

export function savePrefs(userId, prefs) {
  writeLocal(PREFIX, userId, PREFS_KEY, prefs);
  return prefs;
}

export function readSession(userId) {
  return readLocal(PREFIX, userId, SESSION_KEY, null);
}

export function readStops(userId) {
  return readLocal(PREFIX, userId, STOPS_KEY, []);
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
  const text = `${vehicle.category || ""} ${vehicle.name || ""}`.toLowerCase();
  if (/hybrid|prius/.test(text)) return 48;
  if (/electric|ev|tesla/.test(text)) return 100; // MPGe-ish for cost model
  if (/truck|suv|van/.test(text)) return 18;
  if (/bike|scooter|motorcycle/.test(text)) return 55;
  return 26;
}

export function calcFuelCost({ miles, mpg, gasPriceLocal, currency }) {
  const safeMpg = Math.max(Number(mpg) || 25, 1);
  const gallons = Number(miles || 0) / safeMpg;
  const cost = gallons * Number(gasPriceLocal || 0);
  return {
    gallons: Math.round(gallons * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    currency,
    perMile: miles > 0 ? Math.round((cost / miles) * 1000) / 1000 : 0,
  };
}

/**
 * Delivery hotspot suggestions near lat/lng (or city centroid).
 * Colors: red=food corridors, amber=downtown, blue=transit hubs, green=residential demand.
 */
export function buildHotspots({ lat, lng, city }) {
  const baseLat = Number(lat) || 32.7767;
  const baseLng = Number(lng) || -96.797;
  const label = city || "your area";
  return [
    { id: "h1", name: `${label} Restaurant Row`, kind: "food", color: "#ef4444", lat: baseLat + 0.012, lng: baseLng + 0.008, tip: "Dinner rush 5–9pm · stacked orders common" },
    { id: "h2", name: "Downtown core", kind: "downtown", color: "#f59e0b", lat: baseLat + 0.004, lng: baseLng - 0.006, tip: "Lunch + nightlife · short hops" },
    { id: "h3", name: "Airport / transit", kind: "transit", color: "#3b82f6", lat: baseLat - 0.018, lng: baseLng + 0.022, tip: "Rideshare peaks early morning & evenings" },
    { id: "h4", name: "Campus / stadium", kind: "events", color: "#a855f7", lat: baseLat + 0.02, lng: baseLng - 0.015, tip: "Event nights spike demand" },
    { id: "h5", name: "Suburban strip malls", kind: "suburban", color: "#22c55e", lat: baseLat - 0.01, lng: baseLng - 0.02, tip: "Steady grocery & fast food" },
    { id: "h6", name: "Hospital / medical", kind: "medical", color: "#06b6d4", lat: baseLat + 0.008, lng: baseLng + 0.018, tip: "Reliable daytime rides" },
  ];
}

export function openStreetMapEmbed(lat, lng, zoom = 12) {
  const b = 0.04;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - b}%2C${lat - b}%2C${lng + b}%2C${lat + b}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export async function openDriverApp(app) {
  if (typeof window === "undefined") return;
  const started = Date.now();
  window.location.href = app.deepLink;
  window.setTimeout(() => {
    if (Date.now() - started < 2500) {
      window.open(app.web || app.store, "_blank", "noopener,noreferrer");
    }
  }, 900);
}

export async function startDrivingSession(user, prefs) {
  const session = {
    id: uid(),
    user_id: user.id,
    started_at: new Date().toISOString(),
    ended_at: null,
    active: true,
    city: prefs.city || "",
    zip: prefs.zip || "",
    lat: prefs.lat,
    lng: prefs.lng,
    equipment_id: prefs.equipmentId || null,
    currency: prefs.currency || "USD",
    miles: 0,
    stops: 0,
    apps: prefs.connectedApps || [],
  };
  writeLocal(PREFIX, user.id, SESSION_KEY, session);
  writeLocal(PREFIX, user.id, STOPS_KEY, []);
  return session;
}

export async function stopDrivingSession(userId) {
  const session = readSession(userId);
  if (!session) return null;
  const stops = readStops(userId);
  const ended = {
    ...session,
    active: false,
    ended_at: new Date().toISOString(),
    stops: stops.length,
    miles: Number(session.miles || 0),
  };
  writeLocal(PREFIX, userId, SESSION_KEY, ended);
  return ended;
}

export function addStop(userId, partial = {}) {
  const session = readSession(userId);
  if (!session?.active) return null;
  const stops = readStops(userId);
  const now = Date.now();
  const last = stops[0];
  const betweenMs = last?.ended_at ? now - new Date(last.ended_at).getTime() : null;
  const stop = {
    id: uid(),
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_sec: 0,
    between_orders_sec: betweenMs != null ? Math.round(betweenMs / 1000) : null,
    miles_delta: Number(partial.miles_delta || 0),
    note: partial.note || "",
    app: partial.app || "",
  };
  writeLocal(PREFIX, userId, STOPS_KEY, [stop, ...stops]);
  return stop;
}

export function endStop(userId, stopId) {
  const stops = readStops(userId);
  const next = stops.map((s) => {
    if (s.id !== stopId || s.ended_at) return s;
    const ended = new Date().toISOString();
    const duration_sec = Math.max(1, Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000));
    return { ...s, ended_at: ended, duration_sec };
  });
  writeLocal(PREFIX, userId, STOPS_KEY, next);
  return next.find((s) => s.id === stopId);
}

export function updateSessionMiles(userId, miles) {
  const session = readSession(userId);
  if (!session) return null;
  const next = { ...session, miles: Number(miles) || 0 };
  writeLocal(PREFIX, userId, SESSION_KEY, next);
  return next;
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
    customer_name: (session.apps || []).join(", ") || "Gig apps",
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
  const closed = (stops || []).filter((s) => s.ended_at);
  const avgStop =
    closed.length > 0
      ? Math.round(closed.reduce((s, x) => s + (x.duration_sec || 0), 0) / closed.length)
      : 0;
  const between = closed
    .map((s) => s.between_orders_sec)
    .filter((n) => typeof n === "number" && n >= 0);
  const avgBetween =
    between.length > 0 ? Math.round(between.reduce((a, b) => a + b, 0) / between.length) : null;
  const elapsedSec = Math.round(
    ((session.ended_at ? new Date(session.ended_at) : new Date()) - new Date(session.started_at)) /
      1000
  );
  return {
    miles: Number(session.miles || 0),
    stops: (stops || []).length,
    avgStopSec: avgStop,
    avgBetweenSec: avgBetween,
    elapsedSec,
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
