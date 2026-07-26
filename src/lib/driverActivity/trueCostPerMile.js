/**
 * True operating cost per mile — what mainly decides if an offer is worth it.
 *
 * Ultimate $/mi =
 *   fuel/mi
 * + maintenance/mi (tires+fluids baseline ~10–13¢)
 * + tire replacement/mi (set cost ÷ life miles, adjusted for miles already on tires)
 * + vehicle purchase depreciation/mi (price ÷ life miles)
 *
 * Then compare offer gross $/mi and accept/deny history to that floor.
 */

import { readLocal, writeLocal } from "../localStore.js";

const PREFIX = "titanos_driver";
const ECON_KEY = "vehicle_economics";
const DECISIONS_KEY = "offer_autopilot_log";

/** Industry-style maintenance band the user asked for (tires + fluids + basic). */
export const MAINTENANCE_CENTS_MIN = 10;
export const MAINTENANCE_CENTS_MAX = 13;
export const DEFAULT_MAINTENANCE_CENTS = 11.5;

export const DEFAULT_VEHICLE_ECONOMICS = Object.freeze({
  /** What you paid for the vehicle */
  purchase_price: 0,
  /** Expected total miles over ownership (amortization denominator) */
  vehicle_life_miles: 150000,
  /** Current odometer (optional) */
  odometer: 0,
  /** Full set of tires cost */
  tire_set_cost: 600,
  /** Rated life of a tire set */
  tire_life_miles: 40000,
  /** Miles already on the current tires (0 = brand new) */
  tire_miles_used: 0,
  /**
   * Basic driving maintenance: tires+fluids+wear allowance, cents per mile.
   * Clamped to 10–13¢ unless user forces outside (we still clamp UI to band).
   */
  maintenance_cents_per_mile: DEFAULT_MAINTENANCE_CENTS,
  mpg: 22,
  gas_usd: 3.5,
});

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round4(n) {
  return Math.round(num(n) * 10000) / 10000;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

export function clampMaintenanceCents(cents) {
  const c = num(cents, DEFAULT_MAINTENANCE_CENTS);
  return Math.min(MAINTENANCE_CENTS_MAX, Math.max(MAINTENANCE_CENTS_MIN, c));
}

export function readVehicleEconomics(userId) {
  if (!userId) return { ...DEFAULT_VEHICLE_ECONOMICS };
  const raw = readLocal(PREFIX, userId, ECON_KEY, null);
  return {
    ...DEFAULT_VEHICLE_ECONOMICS,
    ...(raw && typeof raw === "object" ? raw : {}),
  };
}

export function saveVehicleEconomics(userId, patch = {}) {
  const cur = readVehicleEconomics(userId);
  const next = {
    ...cur,
    ...patch,
    maintenance_cents_per_mile: clampMaintenanceCents(
      patch.maintenance_cents_per_mile ?? cur.maintenance_cents_per_mile
    ),
  };
  writeLocal(PREFIX, userId, ECON_KEY, next);
  return next;
}

/**
 * Pure breakdown of true cost per mile from economics + live fuel inputs.
 */
export function computeTrueCostPerMile(economics = {}, { mpg, gasUsd } = {}) {
  const e = { ...DEFAULT_VEHICLE_ECONOMICS, ...economics };
  const useMpg = Math.max(1, num(mpg, e.mpg) || 22);
  const useGas = Math.max(0.5, num(gasUsd, e.gas_usd) || 3.5);

  const fuel_per_mile = round4(useGas / useMpg);

  const maintCents = clampMaintenanceCents(e.maintenance_cents_per_mile);
  const maintenance_per_mile = round4(maintCents / 100);

  const tireLife = Math.max(1000, num(e.tire_life_miles, 40000));
  const tireUsed = Math.max(0, Math.min(tireLife, num(e.tire_miles_used)));
  const tireRemaining = Math.max(1, tireLife - tireUsed);
  const tireCost = Math.max(0, num(e.tire_set_cost));
  // Spread remaining tire value over remaining miles (higher $/mi as tires age)
  const tires_per_mile = tireCost > 0 ? round4(tireCost / tireRemaining) : 0;
  // Also expose "new tire" rate for reference
  const tires_per_mile_new = tireCost > 0 ? round4(tireCost / tireLife) : 0;

  const purchase = Math.max(0, num(e.purchase_price));
  const lifeMiles = Math.max(1000, num(e.vehicle_life_miles, 150000));
  const odo = Math.max(0, num(e.odometer));
  const remainingLife = Math.max(1000, lifeMiles - Math.min(odo, lifeMiles - 1000));
  // Amortize purchase over remaining life if odometer known, else full life
  const depDenom = odo > 0 ? remainingLife : lifeMiles;
  const depreciation_per_mile = purchase > 0 ? round4(purchase / depDenom) : 0;

  const true_cost_per_mile = round4(
    fuel_per_mile + maintenance_per_mile + tires_per_mile + depreciation_per_mile
  );

  return {
    fuel_per_mile,
    maintenance_per_mile,
    maintenance_cents: maintCents,
    tires_per_mile,
    tires_per_mile_new,
    tire_miles_used: tireUsed,
    tire_miles_remaining: tireRemaining,
    depreciation_per_mile,
    true_cost_per_mile,
    mpg: useMpg,
    gas_usd: useGas,
    purchase_price: purchase,
    vehicle_life_miles: lifeMiles,
  };
}

/**
 * Cost for N miles using true operating model (replaces flat "wear").
 */
export function estimateTrueOperatingCost(miles, economics = {}, fuelOpts = {}) {
  const m = Math.max(0, num(miles));
  const c = computeTrueCostPerMile(economics, fuelOpts);
  return {
    ...c,
    miles: m,
    fuel_cost: round2(m * c.fuel_per_mile),
    maintenance_cost: round2(m * c.maintenance_per_mile),
    tire_cost: round2(m * c.tires_per_mile),
    depreciation_cost: round2(m * c.depreciation_per_mile),
    operating_cost: round2(m * c.true_cost_per_mile),
  };
}

/**
 * From ACCEPT/DENY log: what $/mi you usually take vs skip.
 */
export function acceptDenyMileStats(userId) {
  if (!userId) {
    return {
      accepted_count: 0,
      denied_count: 0,
      avg_accepted_per_mile: null,
      avg_denied_per_mile: null,
      personal_floor_per_mile: null,
    };
  }
  const raw = readLocal(PREFIX, userId, DECISIONS_KEY, []);
  const rows = (Array.isArray(raw) ? raw : []).slice(0, 100);
  const accepted = [];
  const denied = [];
  for (const r of rows) {
    const pay = num(r.pay);
    const miles = num(r.miles);
    if (pay <= 0 || miles <= 0) continue;
    const pm = pay / miles;
    if (r.verdict === "ACCEPT") accepted.push(pm);
    if (r.verdict === "DENY") denied.push(pm);
  }
  const avg = (arr) =>
    arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 100) / 100 : null;
  return {
    accepted_count: accepted.length,
    denied_count: denied.length,
    avg_accepted_per_mile: avg(accepted),
    avg_denied_per_mile: avg(denied),
    /** Soft floor: don't accept below your own accept average * 0.9 when enough samples */
    personal_floor_per_mile:
      accepted.length >= 3 ? Math.round(avg(accepted) * 0.9 * 100) / 100 : null,
  };
}

/**
 * Ultimate worth check for an offer vs true cost + accept history.
 * @returns break-even and recommended min gross $/mi
 */
export function ultimateWorthPerMile({
  economics,
  mpg,
  gasUsd,
  parking = 0,
  totalMiles = 1,
  userId = null,
} = {}) {
  const cost = computeTrueCostPerMile(economics, { mpg, gasUsd });
  const miles = Math.max(0.1, num(totalMiles, 1));
  const parkingPerMile = round4(Math.max(0, num(parking)) / miles);
  const allInFloor = round4(cost.true_cost_per_mile + parkingPerMile);

  const hist = userId ? acceptDenyMileStats(userId) : acceptDenyMileStats(null);
  // Main decision floor: cover true costs; if you have accept history, don't go below it
  let recommended_min_gross_per_mile = allInFloor;
  if (hist.personal_floor_per_mile != null) {
    recommended_min_gross_per_mile = Math.max(allInFloor, hist.personal_floor_per_mile);
  }
  // Small profit buffer (~8¢/mi) so "worth it" means money after costs
  recommended_min_gross_per_mile = round4(recommended_min_gross_per_mile + 0.08);

  return {
    ...cost,
    parking_per_mile: parkingPerMile,
    all_in_cost_per_mile: allInFloor,
    recommended_min_gross_per_mile,
    accept_deny: hist,
  };
}
