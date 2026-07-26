/**
 * Titan Vehicle Logbook — original mileage / fuel / expense recordkeeping.
 * Inspired by common automatic logbook workflows; no third-party branding or UI copy.
 */
import { readLocal, writeLocal, uid } from "../localStore.js";
import { IRS_MILEAGE_RATE_USD } from "../driverHubMath.js";

const PREFIX = "titanos_driver";

export const TRIP_PURPOSES = Object.freeze([
  { id: "business", label: "Work", short: "Work", deductible: true },
  { id: "personal", label: "Personal", short: "Personal", deductible: false },
  { id: "commute", label: "Commute", short: "Commute", deductible: false },
  { id: "medical", label: "Medical", short: "Medical", deductible: true },
  { id: "charity", label: "Charity", short: "Charity", deductible: true },
  { id: "unclassified", label: "Needs review", short: "Review", deductible: false },
]);

export const EXPENSE_CATEGORIES = Object.freeze([
  { id: "fuel", label: "Fuel" },
  { id: "maintenance", label: "Maintenance" },
  { id: "tires", label: "Tires" },
  { id: "insurance", label: "Insurance" },
  { id: "parking", label: "Parking" },
  { id: "tolls", label: "Tolls" },
  { id: "wash", label: "Car wash" },
  { id: "other", label: "Other" },
]);

function classifications(userId) {
  return readLocal(PREFIX, userId, "trip_class", {});
}

function saveClassifications(userId, map) {
  writeLocal(PREFIX, userId, "trip_class", map);
}

export function getTripClassification(userId, tripId) {
  const map = classifications(userId);
  return map[tripId] || { purpose: "unclassified", tags: [], notes: "" };
}

export function setTripClassification(userId, tripId, patch = {}) {
  const map = classifications(userId);
  map[tripId] = {
    purpose: "unclassified",
    tags: [],
    notes: "",
    ...map[tripId],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  saveClassifications(userId, map);
  return map[tripId];
}

export function purposeMeta(purposeId) {
  return TRIP_PURPOSES.find((p) => p.id === purposeId) || TRIP_PURPOSES[TRIP_PURPOSES.length - 1];
}

/** Auto-tag rules: time-of-day and optional weekday. */
export function readTagRules(userId) {
  return readLocal(PREFIX, userId, "tag_rules", [
    {
      id: "default-work-hours",
      name: "Weekday work window",
      purpose: "business",
      weekdays: [1, 2, 3, 4, 5],
      startHour: 7,
      endHour: 19,
      enabled: true,
    },
  ]);
}

export function saveTagRules(userId, rules) {
  writeLocal(PREFIX, userId, "tag_rules", Array.isArray(rules) ? rules : []);
  return readTagRules(userId);
}

export function applyTagRules(startedAt, rules = []) {
  if (!startedAt) return null;
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return null;
  const dow = d.getDay();
  const h = d.getHours() + d.getMinutes() / 60;
  for (const rule of rules || []) {
    if (!rule?.enabled) continue;
    const days = Array.isArray(rule.weekdays) ? rule.weekdays : null;
    if (days && !days.includes(dow)) continue;
    const start = Number(rule.startHour);
    const end = Number(rule.endHour);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const inWindow = start <= end ? h >= start && h < end : h >= start || h < end;
    if (inWindow) return rule.purpose || "business";
  }
  return null;
}

/**
 * Enrich session list with classification; auto-apply rules once for unclassified.
 */
export function enrichTripsWithClassification(userId, sessions = []) {
  const rules = readTagRules(userId);
  return (sessions || []).map((s) => {
    let cls = getTripClassification(userId, s.id);
    if (cls.purpose === "unclassified" || !cls.purpose) {
      const auto = applyTagRules(s.started_at, rules);
      if (auto) {
        cls = setTripClassification(userId, s.id, {
          purpose: auto,
          auto_tagged: true,
          notes: cls.notes || "Auto-tagged by time rule",
        });
      }
    }
    const meta = purposeMeta(cls.purpose);
    const miles = Number(s.miles) || 0;
    return {
      ...s,
      classification: cls,
      purpose: cls.purpose,
      purpose_label: meta.label,
      deductible: meta.deductible,
      deductible_estimate: meta.deductible
        ? Math.round(miles * IRS_MILEAGE_RATE_USD * 100) / 100
        : 0,
    };
  });
}

export function logbookTotals(enriched = []) {
  const work = enriched.filter((t) => t.deductible);
  const personal = enriched.filter((t) => !t.deductible);
  const workMiles = work.reduce((s, t) => s + (Number(t.miles) || 0), 0);
  const personalMiles = personal.reduce((s, t) => s + (Number(t.miles) || 0), 0);
  const review = enriched.filter((t) => t.purpose === "unclassified").length;
  return {
    trips: enriched.length,
    work_miles: Math.round(workMiles * 10) / 10,
    personal_miles: Math.round(personalMiles * 10) / 10,
    deductible_usd: Math.round(workMiles * IRS_MILEAGE_RATE_USD * 100) / 100,
    needs_review: review,
  };
}

/* —— Fuel fill-ups —— */
export function listFuelLogs(userId) {
  const rows = readLocal(PREFIX, userId, "fuel_logs", []);
  return Array.isArray(rows) ? rows : [];
}

export function addFuelLog(userId, values = {}) {
  const row = {
    id: uid(),
    created_at: new Date().toISOString(),
    date: values.date || new Date().toISOString().slice(0, 10),
    gallons: Number(values.gallons) || 0,
    total_cost: Number(values.total_cost) || 0,
    odometer: values.odometer != null ? Number(values.odometer) : null,
    station: String(values.station || "").trim(),
    notes: String(values.notes || "").trim(),
    vehicle_label: String(values.vehicle_label || "Primary").trim(),
  };
  const next = [row, ...listFuelLogs(userId)];
  writeLocal(PREFIX, userId, "fuel_logs", next);
  return row;
}

export function deleteFuelLog(userId, id) {
  writeLocal(
    PREFIX,
    userId,
    "fuel_logs",
    listFuelLogs(userId).filter((r) => r.id !== id)
  );
}

export function fuelEconomyStats(logs = []) {
  const rows = [...(logs || [])]
    .filter((r) => r.odometer != null && Number(r.gallons) > 0)
    .sort((a, b) => Number(a.odometer) - Number(b.odometer));
  if (rows.length < 2) {
    const spent = (logs || []).reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
    return { mpg: null, fillups: logs?.length || 0, spent: Math.round(spent * 100) / 100 };
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  const miles = Number(last.odometer) - Number(first.odometer);
  const gallons = rows.slice(1).reduce((s, r) => s + Number(r.gallons), 0);
  const spent = (logs || []).reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
  return {
    mpg: gallons > 0 && miles > 0 ? Math.round((miles / gallons) * 10) / 10 : null,
    fillups: logs.length,
    spent: Math.round(spent * 100) / 100,
    miles_tracked: Math.round(miles * 10) / 10,
  };
}

/* —— Vehicle expenses —— */
export function listVehicleExpenses(userId) {
  const rows = readLocal(PREFIX, userId, "vehicle_expenses", []);
  return Array.isArray(rows) ? rows : [];
}

export function addVehicleExpense(userId, values = {}) {
  const row = {
    id: uid(),
    created_at: new Date().toISOString(),
    date: values.date || new Date().toISOString().slice(0, 10),
    category: values.category || "other",
    amount: Number(values.amount) || 0,
    vendor: String(values.vendor || "").trim(),
    notes: String(values.notes || "").trim(),
    vehicle_label: String(values.vehicle_label || "Primary").trim(),
  };
  const next = [row, ...listVehicleExpenses(userId)];
  writeLocal(PREFIX, userId, "vehicle_expenses", next);
  return row;
}

export function deleteVehicleExpense(userId, id) {
  writeLocal(
    PREFIX,
    userId,
    "vehicle_expenses",
    listVehicleExpenses(userId).filter((r) => r.id !== id)
  );
}

/* —— Service reminders —— */
export function listServiceReminders(userId) {
  const rows = readLocal(PREFIX, userId, "service_reminders", []);
  return Array.isArray(rows) ? rows : [];
}

export function addServiceReminder(userId, values = {}) {
  const row = {
    id: uid(),
    created_at: new Date().toISOString(),
    title: String(values.title || "Service").trim(),
    due_date: values.due_date || null,
    due_odometer: values.due_odometer != null ? Number(values.due_odometer) : null,
    notes: String(values.notes || "").trim(),
    done: false,
  };
  const next = [row, ...listServiceReminders(userId)];
  writeLocal(PREFIX, userId, "service_reminders", next);
  return row;
}

export function toggleServiceReminder(userId, id, done) {
  const next = listServiceReminders(userId).map((r) =>
    r.id === id ? { ...r, done: done ?? !r.done } : r
  );
  writeLocal(PREFIX, userId, "service_reminders", next);
  return next.find((r) => r.id === id);
}

/** IRS-style logbook CSV with purpose column from classifications. */
export function buildLogbookCsv(enrichedTrips = []) {
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
    "notes",
  ];
  const lines = [header.join(",")];
  for (const t of enrichedTrips || []) {
    const notes = String(t.classification?.notes || t.notes || "").replace(/"/g, '""');
    lines.push(
      [
        (t.started_at || "").slice(0, 10),
        t.started_at || "",
        t.ended_at || "",
        Number(t.miles) || 0,
        t.purpose_label || t.purpose || "",
        t.deductible ? "yes" : "no",
        t.deductible_estimate || 0,
        Number(t.drive_sec) || 0,
        Number(t.idle_sec) || 0,
        Number(t.stops) || 0,
        `"${notes}"`,
      ].join(",")
    );
  }
  return lines.join("\n");
}
