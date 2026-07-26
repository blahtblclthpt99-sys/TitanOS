/**
 * Offer profitability analyzer — stacks, same-restaurant, parking, fuel, wear.
 * Uses this driver's logged history + ZIP averages to ACCEPT / DENY.
 * Decision aid only: TitanOS does not auto-tap third-party gig apps (ToS-safe).
 */

import { estimateFuelCost, estimateWearCost, DEFAULT_WORTH_THRESHOLDS } from "./intelligence.js";
import { getZipBenchmark, normalizeZip } from "./zipBenchmarks.js";
import { readLocal, writeLocal } from "../localStore.js";

const PREFIX = "titanos_driver";
const THRESH_KEY = "offer_thresholds";

export const DEFAULT_OFFER_THRESHOLDS = Object.freeze({
  ...DEFAULT_WORTH_THRESHOLDS,
  /** Auto-DENY if estimated net $/hr below this */
  minHourlyAccept: 18,
  /** Auto-DENY if net profit below this ($) */
  minProfitAccept: 2.5,
  /** Auto-DENY if $/mi (after costs) below this */
  minPerMileAccept: 0.85,
  /** Extra minutes assumed per stacked order (wait + handoff) */
  stackExtraMin: 8,
  /** Extra miles assumed per stacked drop (when not same restaurant) */
  stackExtraMiles: 1.5,
  /** Same-restaurant stack: shared pickup — lower extra miles */
  sameRestaurantExtraMiles: 0.4,
  /** Same-restaurant: slightly less wait than full second pickup */
  sameRestaurantExtraMin: 5,
  /** Default parking if user doesn't enter one */
  defaultParking: 0,
  /** Require ACCEPT to beat ALL of hourly + profit + per-mile (strict) */
  requireAllGates: false,
  /**
   * When ZIP has enough samples, raise floors toward that ZIP's average
   * (0.9 = offer must clear 90% of your historical ZIP average).
   */
  zipFloorFactor: 0.9,
  /** Minimum logged trips in a ZIP before averages influence gates */
  zipMinSamples: 2,
  /** Offer must clear this fraction of ZIP avg $/mi or $/hr to pass zipBeat */
  zipBeatFactor: 0.95,
});

export function readOfferThresholds(userId) {
  if (!userId) return { ...DEFAULT_OFFER_THRESHOLDS };
  const raw = readLocal(PREFIX, userId, THRESH_KEY, null);
  return { ...DEFAULT_OFFER_THRESHOLDS, ...(raw && typeof raw === "object" ? raw : {}) };
}

export function saveOfferThresholds(userId, patch = {}) {
  const next = { ...readOfferThresholds(userId), ...patch };
  writeLocal(PREFIX, userId, THRESH_KEY, next);
  return next;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalize offer inputs into effective miles/minutes/pay after stack + parking rules.
 */
export function normalizeOfferInput(input = {}, thresholds = DEFAULT_OFFER_THRESHOLDS) {
  const pay = Math.max(0, num(input.pay, num(input.expected_earnings)));
  const tip = Math.max(0, num(input.tip, num(input.tips)));
  const baseMiles = Math.max(0, num(input.miles, num(input.estimated_miles)));
  const baseMin = Math.max(1, num(input.minutes, num(input.drive_minutes)));
  const deadhead = Math.max(0, num(input.deadhead_miles));
  const parking = Math.max(0, num(input.parking, thresholds.defaultParking));
  const stackCount = Math.max(1, Math.floor(num(input.stack_count, num(input.orders, 1))));
  const sameRestaurant = Boolean(input.same_restaurant);
  const extraOrders = Math.max(0, stackCount - 1);

  let extraMiles = 0;
  let extraMin = 0;
  if (extraOrders > 0) {
    if (sameRestaurant) {
      extraMiles = extraOrders * num(thresholds.sameRestaurantExtraMiles, 0.4);
      extraMin = extraOrders * num(thresholds.sameRestaurantExtraMin, 5);
    } else {
      extraMiles = extraOrders * num(thresholds.stackExtraMiles, 1.5);
      extraMin = extraOrders * num(thresholds.stackExtraMin, 8);
    }
  }

  const totalMiles = Math.round((baseMiles + deadhead + extraMiles) * 10) / 10;
  const totalMin = Math.round(baseMin + extraMin);
  const gross = Math.round((pay + tip) * 100) / 100;

  return {
    pay,
    tip,
    gross,
    baseMiles,
    deadhead,
    extraMiles: Math.round(extraMiles * 10) / 10,
    totalMiles,
    baseMin,
    extraMin,
    totalMin,
    parking,
    stackCount,
    sameRestaurant,
    extraOrders,
  };
}

/**
 * Raise deny floors using this driver's ZIP / overall averages when enough data exists.
 */
export function resolveEffectiveThresholds(thresholds = {}, benchmark = null) {
  const t = { ...DEFAULT_OFFER_THRESHOLDS, ...thresholds };
  let minHourlyAccept = num(t.minHourlyAccept, 18);
  let minPerMileAccept = num(t.minPerMileAccept, 0.85);
  const minProfitAccept = num(t.minProfitAccept, 2.5);
  const factor = num(t.zipFloorFactor, 0.9);
  const minSamples = Math.max(1, Math.floor(num(t.zipMinSamples, 2)));

  if (benchmark && benchmark.trips >= minSamples) {
    if (benchmark.avg_per_hour > 0) {
      minHourlyAccept = Math.max(
        minHourlyAccept,
        Math.round(benchmark.avg_per_hour * factor * 10) / 10
      );
    }
    if (benchmark.avg_per_mile > 0) {
      minPerMileAccept = Math.max(
        minPerMileAccept,
        Math.round(benchmark.avg_per_mile * factor * 100) / 100
      );
    }
  }

  return {
    ...t,
    minHourlyAccept,
    minPerMileAccept,
    minProfitAccept,
    calibratedFromZip: Boolean(benchmark && benchmark.trips >= minSamples),
  };
}

/**
 * Full profitability formula + ACCEPT / MARGINAL / DENY verdict.
 * @param {object} input — pay, tip, miles, minutes, zip, stack, parking, …
 * @param {object} thresholds — deny floors
 * @param {object} [context] — { benchmarks } from buildZipBenchmarks
 */
export function analyzeOffer(input = {}, thresholds = DEFAULT_OFFER_THRESHOLDS, context = {}) {
  const zip = normalizeZip(input.zip || context.zip || "");
  const benchmark = getZipBenchmark(context.benchmarks || null, zip);
  const t = resolveEffectiveThresholds(thresholds, benchmark);
  const n = normalizeOfferInput(input, t);
  const mpg = num(input.mpg, t.defaultMpg);
  const gas = num(input.gasUsd, t.fuelUsdPerGallon);

  const fuel = estimateFuelCost(n.totalMiles, { mpg, gasUsd: gas });
  const wear = estimateWearCost(n.totalMiles);
  const costs = Math.round((fuel + wear + n.parking) * 100) / 100;
  const netProfit = Math.round((n.gross - costs) * 100) / 100;
  const hourlyGross = n.totalMin > 0 ? (n.gross / n.totalMin) * 60 : 0;
  const hourlyNet = n.totalMin > 0 ? (netProfit / n.totalMin) * 60 : 0;
  const perMileGross = n.totalMiles > 0 ? n.gross / n.totalMiles : 0;
  const perMileNet = n.totalMiles > 0 ? netProfit / n.totalMiles : 0;

  const beatFactor = num(t.zipBeatFactor, 0.95);
  const hasZipData = benchmark.trips >= num(t.zipMinSamples, 2);
  const beatsZipHourly =
    !hasZipData ||
    !benchmark.avg_per_hour ||
    hourlyGross >= benchmark.avg_per_hour * beatFactor;
  const beatsZipMile =
    !hasZipData ||
    !benchmark.avg_per_mile ||
    perMileGross >= benchmark.avg_per_mile * beatFactor;
  const zipBeat = !hasZipData || beatsZipHourly || beatsZipMile;

  const gates = {
    hourly: hourlyNet >= t.minHourlyAccept,
    profit: netProfit >= t.minProfitAccept,
    perMile: perMileNet >= t.minPerMileAccept,
    zipBeat,
  };
  const coreGates = [gates.hourly, gates.profit, gates.perMile];
  const corePass = coreGates.filter(Boolean).length;
  const allPass = corePass === 3 && gates.zipBeat;
  const anyPass = corePass > 0;

  let verdict = "MARGINAL";
  let action = "Think twice — only take if you can stay in zone.";
  if (t.requireAllGates ? allPass : corePass >= 2 && gates.hourly && gates.zipBeat) {
    verdict = "ACCEPT";
    action = hasZipData
      ? `Profitable vs your ${benchmark.zip || "area"} average — take this offer.`
      : "Profitable — take this offer.";
  } else if (!gates.zipBeat && corePass >= 2) {
    verdict = "DENY";
    action = `Below your ${benchmark.zip || "ZIP"} average — decline unless repositioning.`;
  } else if (!anyPass || (!gates.hourly && !gates.profit)) {
    verdict = "DENY";
    action = "Not beneficial — skip / decline this offer.";
  } else if (!gates.hourly) {
    verdict = "DENY";
    action = "Hourly too low after fuel, wear, and parking — decline.";
  }

  const reasons = [];
  if (n.stackCount > 1) {
    reasons.push(
      n.sameRestaurant
        ? `Double/stack ×${n.stackCount} from same restaurant (+${n.extraMiles} mi, +${n.extraMin} min).`
        : `Stacked orders ×${n.stackCount} (+${n.extraMiles} mi, +${n.extraMin} min for extra drops).`
    );
  }
  if (n.parking > 0) reasons.push(`Parking −$${n.parking.toFixed(2)}.`);
  if (n.deadhead > 0) reasons.push(`Deadhead / return ${n.deadhead} mi included.`);
  if (hasZipData) {
    const where =
      benchmark.source === "zip"
        ? `ZIP ${benchmark.zip}`
        : benchmark.source === "region"
          ? `region ${benchmark.zip}`
          : "your overall logged average";
    reasons.push(
      `${where}: avg $${benchmark.avg_per_mile ?? "—"}/mi · $${benchmark.avg_per_hour ?? "—"}/hr` +
        ` across ${benchmark.trips} paid trip${benchmark.trips === 1 ? "" : "s"}.`
    );
    if (t.calibratedFromZip) {
      reasons.push(
        `Deny floors raised to $${t.minHourlyAccept}/hr and $${t.minPerMileAccept}/mi from your history.`
      );
    }
    if (!gates.zipBeat) {
      reasons.push(
        `This offer ($${perMileGross.toFixed(2)}/mi · $${hourlyGross.toFixed(0)}/hr gross) is under that ZIP average.`
      );
    }
  } else if (zip) {
    reasons.push(`No paid trips logged yet for ZIP ${zip} — using your base floors only.`);
  }
  if (verdict === "ACCEPT") {
    reasons.push(`Net ~$${hourlyNet.toFixed(0)}/hr and $${perMileNet.toFixed(2)}/mi after costs.`);
  } else if (verdict === "DENY") {
    if (!gates.hourly) reasons.push(`Net hourly $${hourlyNet.toFixed(2)} below your $${t.minHourlyAccept} floor.`);
    if (!gates.profit) reasons.push(`Net profit $${netProfit.toFixed(2)} below $${t.minProfitAccept} floor.`);
    if (!gates.perMile) reasons.push(`Net $/mi $${perMileNet.toFixed(2)} below $${t.minPerMileAccept} floor.`);
  } else {
    reasons.push("Mixed signals — meets some gates but not a clear win.");
  }

  return {
    verdict, // ACCEPT | MARGINAL | DENY
    action,
    reasons,
    gates,
    zip,
    zipBenchmark: hasZipData || benchmark.trips > 0 ? benchmark : null,
    thresholds: {
      minHourlyAccept: t.minHourlyAccept,
      minProfitAccept: t.minProfitAccept,
      minPerMileAccept: t.minPerMileAccept,
      calibratedFromZip: t.calibratedFromZip,
    },
    breakdown: {
      ...n,
      fuel,
      wear,
      costs,
      netProfit,
      hourlyGross: Math.round(hourlyGross * 100) / 100,
      hourlyNet: Math.round(hourlyNet * 100) / 100,
      perMileGross: Math.round(perMileGross * 100) / 100,
      perMileNet: Math.round(perMileNet * 100) / 100,
      mpg,
      gas,
    },
    formula:
      "Net = (pay + tip) − fuel − wear − parking; " +
      "Hourly = net ÷ total minutes × 60; " +
      "$/mi = net ÷ total miles; " +
      "ZIP avg from your logged paid trips raises floors and must be beaten for ACCEPT.",
  };
}
