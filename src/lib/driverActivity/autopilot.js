/**
 * Set-&-forget offer autopilot — built to make drivers more money.
 * Protects $/hr by denying cheap trips that drag your average down.
 * Uses full spectrum (hourly, profit, $/mi, ZIP, stack, parking, fuel/wear, rush).
 * Decision aid only — does not auto-tap Uber/DoorDash (ToS-safe).
 */

import {
  analyzeOffer,
  readOfferThresholds,
  DEFAULT_OFFER_THRESHOLDS,
} from "./offerAnalyzer.js";
import { classifyRushWindow } from "./intelligence.js";
import { normalizeZip } from "./zipBenchmarks.js";
import { readLocal, writeLocal, uid } from "../localStore.js";

const PREFIX = "titanos_driver";
const AUTO_KEY = "offer_autopilot";
const DECISIONS_KEY = "offer_autopilot_log";
const MAX_LOG = 200;

/**
 * Money-first presets — every profile exists to raise take-home, not trip count.
 * Chill still filters trash; Strict only takes fat offers.
 */
export const AUTOPILOT_PROFILES = Object.freeze({
  chill: Object.freeze({
    id: "chill",
    label: "Keep busy",
    blurb: "Still skips money-losers — takes more when slow.",
    patch: {
      minHourlyAccept: 15,
      minProfitAccept: 2,
      minPerMileAccept: 0.75,
      zipFloorFactor: 0.85,
      zipBeatFactor: 0.88,
      requireAllGates: false,
      defaultParking: 0,
    },
  }),
  balanced: Object.freeze({
    id: "balanced",
    label: "Max money",
    blurb: "Protect your $/hr — Titan’s money-first default.",
    patch: {
      minHourlyAccept: 20,
      minProfitAccept: 3,
      minPerMileAccept: 1.0,
      zipFloorFactor: 0.95,
      zipBeatFactor: 0.98,
      requireAllGates: false,
      defaultParking: 0,
    },
  }),
  strict: Object.freeze({
    id: "strict",
    label: "High roller",
    blurb: "Only clear winners that beat your ZIP average.",
    patch: {
      minHourlyAccept: 26,
      minProfitAccept: 5,
      minPerMileAccept: 1.4,
      zipFloorFactor: 1.05,
      zipBeatFactor: 1.0,
      requireAllGates: true,
      defaultParking: 0,
    },
  }),
});

export const DEFAULT_AUTOPILOT = Object.freeze({
  enabled: false,
  profileId: "balanced",
  useZipAverages: true,
  autoParking: true,
  assumeDeadheadMiles: 1,
  defaultStackCount: 1,
  rushAware: true,
  /** Never accept below your personal/ZIP hourly average (money protection) */
  protectHourlyAverage: true,
  glanceMode: true,
});

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function readAutopilotSettings(userId) {
  if (!userId) return { ...DEFAULT_AUTOPILOT };
  const raw = readLocal(PREFIX, userId, AUTO_KEY, null);
  return { ...DEFAULT_AUTOPILOT, ...(raw && typeof raw === "object" ? raw : {}) };
}

export function saveAutopilotSettings(userId, patch = {}) {
  const next = { ...readAutopilotSettings(userId), ...patch };
  if (next.profileId && !AUTOPILOT_PROFILES[next.profileId]) next.profileId = "balanced";
  writeLocal(PREFIX, userId, AUTO_KEY, next);
  return next;
}

export function getAutopilotProfile(profileId = "balanced") {
  return AUTOPILOT_PROFILES[profileId] || AUTOPILOT_PROFILES.balanced;
}

export function resolveAutopilotThresholds(userId, settings = null) {
  const s = settings || readAutopilotSettings(userId);
  const base = readOfferThresholds(userId);
  const profile = getAutopilotProfile(s.profileId);
  return {
    ...DEFAULT_OFFER_THRESHOLDS,
    ...base,
    ...profile.patch,
  };
}

export function parseOfferQuickText(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const money = [...raw.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(?:\$|usd)?/gi)].map((m) => Number(m[1]));
  const miles = raw.match(/(\d+(?:\.\d+)?)\s*(?:mi|miles?)\b/i);
  const mins = raw.match(/(\d+(?:\.\d+)?)\s*(?:min|mins?|minutes?)\b/i);
  const zip = raw.match(/\b(\d{5})\b/);
  const stack = raw.match(/(?:x|×|stack(?:ed)?|orders?)\s*[:=]?\s*(\d)/i);

  const slash = raw.match(/^(\d+(?:\.\d+)?)\s*[\/|]\s*(\d+(?:\.\d+)?)\s*[\/|]\s*(\d+(?:\.\d+)?)/);
  if (slash) {
    return {
      pay: Number(slash[1]),
      tip: 0,
      miles: Number(slash[2]),
      minutes: Number(slash[3]),
      zip: zip?.[1] || "",
      stack_count: stack ? Number(stack[1]) : 1,
    };
  }

  const pay = money[0] ?? null;
  const tip = money.length > 1 ? money[1] : 0;
  if (pay == null && !miles && !mins) return null;
  return {
    pay: pay ?? 0,
    tip: tip || 0,
    miles: miles ? Number(miles[1]) : 0,
    minutes: mins ? Number(mins[1]) : 0,
    zip: zip?.[1] || "",
    stack_count: stack ? Number(stack[1]) : 1,
  };
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Score each spectrum 0–100 — weighted toward money metrics. */
export function buildSpectrumScores(analysis, { rush = null, rushAware = true } = {}) {
  const b = analysis?.breakdown || {};
  const t = analysis?.thresholds || {};
  const gates = analysis?.gates || {};

  const hourly = clampScore((num(b.hourlyNet) / Math.max(1, num(t.minHourlyAccept, 18))) * 70);
  const profit = clampScore((num(b.netProfit) / Math.max(0.5, num(t.minProfitAccept, 2.5))) * 70);
  const perMile = clampScore((num(b.perMileNet) / Math.max(0.25, num(t.minPerMileAccept, 0.85))) * 70);
  const zip = gates.zipBeat ? (analysis.zipBenchmark?.trips >= 2 ? 85 : 70) : 25;
  const stack =
    num(b.stackCount, 1) <= 1
      ? 75
      : b.sameRestaurant
        ? clampScore(70 + Math.min(20, num(b.stackCount) * 5))
        : clampScore(55 - Math.max(0, num(b.stackCount) - 2) * 10);
  const parking = num(b.parking) <= 0 ? 90 : clampScore(90 - num(b.parking) * 12);
  const costs =
    num(b.gross) <= 0
      ? 0
      : clampScore(100 - (num(b.costs) / Math.max(0.01, num(b.gross))) * 100);

  let rushScore = 70;
  if (rushAware && rush?.id) {
    if (["lunch", "dinner", "breakfast"].includes(rush.id)) rushScore = 85;
    else if (rush.id === "afternoon") rushScore = 55;
    else if (rush.id === "overnight") rushScore = 45;
    else rushScore = 65;
  }

  const dims = {
    hourly,
    profit,
    per_mile: perMile,
    zip,
    stack,
    parking,
    cost_efficiency: costs,
    rush: rushScore,
  };
  const overall = clampScore(
    hourly * 0.22 +
      profit * 0.18 +
      perMile * 0.18 +
      zip * 0.16 +
      costs * 0.1 +
      stack * 0.06 +
      parking * 0.05 +
      rushScore * 0.05
  );
  return { ...dims, overall };
}

/**
 * Compare this offer’s net $/hr to your ZIP / overall average.
 * Positive = makes you more than usual; negative = drags your average down.
 */
export function estimateMoneyDelta(analysis) {
  const hourlyNet = num(analysis?.breakdown?.hourlyNet);
  const benchHr = num(analysis?.zipBenchmark?.avg_per_hour);
  const floor = num(analysis?.thresholds?.minHourlyAccept, 18);
  const baseline = benchHr > 0 ? benchHr : floor;
  const deltaPerHour = Math.round((hourlyNet - baseline) * 100) / 100;
  const minutes = Math.max(1, num(analysis?.breakdown?.totalMin, 15));
  const tripDelta = Math.round(deltaPerHour * (minutes / 60) * 100) / 100;
  return {
    baseline_hourly: baseline,
    offer_hourly: Math.round(hourlyNet * 100) / 100,
    delta_per_hour: deltaPerHour,
    trip_delta: tripDelta,
    protects_average: deltaPerHour >= 0,
  };
}

function moneyFirstAction(verdict, money, rush) {
  if (verdict === "ACCEPT") {
    if (money.delta_per_hour > 0) {
      return `Take it — ~$${Math.abs(money.delta_per_hour).toFixed(0)}/hr above your usual. More money.`;
    }
    return "Take it — clears your money floors after fuel, wear, and parking.";
  }
  if (verdict === "DENY") {
    if (money.delta_per_hour < 0 && money.baseline_hourly > 0) {
      return `Skip — would drag you ~$${Math.abs(money.delta_per_hour).toFixed(0)}/hr below your average. Protect the bag.`;
    }
    return rush?.id === "afternoon"
      ? "Skip — wait for a better-paying rush. Don’t work for scraps."
      : "Skip — not worth your time or miles after costs.";
  }
  return "Borderline — only take if it positions you for a better-paying zone.";
}

/** Full set-&-forget decision: fill defaults, run formula, protect earnings. */
export function decideOfferSetForget(input = {}, context = {}) {
  const settings = context.settings || DEFAULT_AUTOPILOT;
  const thresholds =
    context.thresholds ||
    resolveAutopilotThresholds(context.userId, settings);
  const rush = context.rush || classifyRushWindow(context.now || new Date());

  const filled = {
    ...input,
    zip: normalizeZip(input.zip || context.zip || "") || "",
    parking:
      input.parking != null && input.parking !== ""
        ? num(input.parking)
        : settings.autoParking
          ? num(thresholds.defaultParking)
          : 0,
    deadhead_miles:
      input.deadhead_miles != null && input.deadhead_miles !== ""
        ? num(input.deadhead_miles)
        : num(settings.assumeDeadheadMiles, 1),
    stack_count:
      input.stack_count != null && input.stack_count !== ""
        ? Math.max(1, Math.floor(num(input.stack_count, 1)))
        : Math.max(1, Math.floor(num(settings.defaultStackCount, 1))),
    same_restaurant: Boolean(input.same_restaurant),
    mpg: num(input.mpg, context.mpg),
    gasUsd: num(input.gasUsd, context.gasUsd),
  };

  const analysis = analyzeOffer(
    filled,
    thresholds,
    settings.useZipAverages
      ? { benchmarks: context.benchmarks, zip: filled.zip, userId: context.userId, economics: context.economics }
      : { userId: context.userId, economics: context.economics }
  );

  const spectrum = buildSpectrumScores(analysis, {
    rush,
    rushAware: settings.rushAware !== false,
  });
  const money = estimateMoneyDelta(analysis);

  let verdict = analysis.verdict;

  // Money protection: never let a trip pull your $/hr below your proven average
  if (
    settings.protectHourlyAverage !== false &&
    money.baseline_hourly > 0 &&
    analysis.zipBenchmark?.trips >= 2 &&
    money.delta_per_hour < -1 &&
    money.offer_hourly < money.baseline_hourly * 0.92
  ) {
    verdict = "DENY";
  }

  if (
    settings.rushAware &&
    verdict === "MARGINAL" &&
    rush?.id === "afternoon" &&
    spectrum.overall < 62
  ) {
    verdict = "DENY";
  } else if (
    settings.rushAware &&
    verdict === "MARGINAL" &&
    ["lunch", "dinner"].includes(rush?.id) &&
    spectrum.overall >= 65 &&
    analysis.gates.hourly &&
    money.protects_average
  ) {
    verdict = "ACCEPT";
  }

  if (
    spectrum.overall >= 78 &&
    verdict !== "ACCEPT" &&
    analysis.gates.hourly &&
    analysis.gates.profit &&
    money.protects_average
  ) {
    verdict = "ACCEPT";
  } else if (spectrum.overall <= 38 && verdict !== "DENY") {
    verdict = "DENY";
  }

  const action = moneyFirstAction(verdict, money, rush);

  return {
    ...analysis,
    verdict,
    action,
    spectrum,
    money,
    rush,
    profileId: settings.profileId,
    autopilot: true,
    moneyFirst: true,
    filled,
  };
}

export function logAutopilotDecision(userId, decision, offerInput = {}) {
  if (!userId || !decision) return null;
  const rows = readLocal(PREFIX, userId, DECISIONS_KEY, []);
  const list = Array.isArray(rows) ? rows : [];
  const entry = {
    id: uid(),
    at: new Date().toISOString(),
    verdict: decision.verdict,
    spectrum_overall: decision.spectrum?.overall ?? null,
    money_delta_hr: decision.money?.delta_per_hour ?? null,
    pay: num(offerInput.pay ?? decision.filled?.pay),
    miles: num(offerInput.miles ?? decision.filled?.miles),
    minutes: num(offerInput.minutes ?? decision.filled?.minutes),
    zip: decision.zip || decision.filled?.zip || "",
    profileId: decision.profileId || null,
  };
  writeLocal(PREFIX, userId, DECISIONS_KEY, [entry, ...list].slice(0, MAX_LOG));
  return entry;
}

export function listAutopilotDecisions(userId, limit = 20) {
  if (!userId) return [];
  const rows = readLocal(PREFIX, userId, DECISIONS_KEY, []);
  return (Array.isArray(rows) ? rows : []).slice(0, limit);
}

/** Rough $ protected by DENY decisions that were below average. */
export function summarizeMoneyProtected(userId) {
  const rows = listAutopilotDecisions(userId, 100);
  let deniedBelow = 0;
  let acceptedAbove = 0;
  for (const r of rows) {
    const d = num(r.money_delta_hr);
    const mins = Math.max(1, num(r.minutes, 15));
    const trip = d * (mins / 60);
    if (r.verdict === "DENY" && d < 0) deniedBelow += Math.abs(trip);
    if (r.verdict === "ACCEPT" && d > 0) acceptedAbove += trip;
  }
  return {
    decisions: rows.length,
    estimated_protected_usd: Math.round(deniedBelow * 100) / 100,
    estimated_captured_usd: Math.round(acceptedAbove * 100) / 100,
  };
}
