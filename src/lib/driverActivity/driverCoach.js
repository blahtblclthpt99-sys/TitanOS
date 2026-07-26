/**
 * Driver Money Coach — richer, money-first response copy for Hub surfaces.
 * Deterministic (no LLM). Speaks in clear ACCEPT/DENY + $/mi language.
 */

import { classifyRushWindow } from "./intelligence.js";
import {
  computeTrueCostPerMile,
  ultimateWorthPerMile,
  mileMarginVsFloor,
  readVehicleEconomics,
} from "./trueCostPerMile.js";
import { summarizeMoneyProtected } from "./autopilot.js";

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function money(n, digits = 2) {
  const v = num(n);
  return `$${v.toFixed(digits)}`;
}

/**
 * One-glance offer coach card for UI + speech helpers.
 */
export function formatOfferCoachCard(decision) {
  if (!decision) {
    return {
      headline: "No offer yet",
      subline: "Paste or speak pay, miles, and minutes.",
      glance: "Waiting for an offer.",
      tone: "neutral",
    };
  }
  const v = decision.verdict || "MARGINAL";
  const offerMi = num(decision.breakdown?.perMileGross);
  const needMi = num(decision.trueCost?.recommended_min_gross_per_mile);
  const netHr = num(decision.breakdown?.hourlyNet);
  const gap = mileMarginVsFloor(offerMi, needMi);
  const tone = v === "ACCEPT" ? "good" : v === "DENY" ? "bad" : "warn";

  let headline =
    v === "ACCEPT" ? "Take it — money clears your floor" : v === "DENY" ? "Skip — protects your average" : "Borderline";
  if (v === "ACCEPT" && decision.money?.delta_per_hour > 2) {
    headline = `Take it — ~$${Math.round(decision.money.delta_per_hour)}/hr above your usual`;
  }
  if (v === "DENY" && gap.clears === false) {
    headline = `Skip — ${money(offerMi)}/mi under ${money(needMi)}/mi floor`;
  }

  const subline =
    decision.action ||
    (gap.margin != null
      ? `Offer ${money(offerMi)}/mi · need ≥ ${money(needMi)}/mi · ${gap.clears ? "+" : ""}${money(gap.margin)}/mi`
      : "");

  const glance = [
    v,
    offerMi ? `${money(offerMi)}/mi` : null,
    needMi ? `need ${money(needMi)}` : null,
    netHr ? `~$${Math.round(netHr)}/hr net` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { headline, subline, glance, tone, verdict: v, gap };
}

/**
 * Smart shift tip — day-part + rush + true-cost + history when available.
 */
export function composeSmartCoachTip({
  mode = "driving",
  dayPart = "dinner",
  rush = null,
  economics = null,
  mpg = 22,
  gasUsd = 3.5,
  userId = null,
  weekSummary = null,
} = {}) {
  const rushObj = rush || classifyRushWindow(new Date());
  const econ = economics || (userId ? readVehicleEconomics(userId) : {});
  const floor = ultimateWorthPerMile({
    economics: econ,
    mpg,
    gasUsd,
    parking: 0,
    totalMiles: 5,
    userId,
  });
  const need = floor.recommended_min_gross_per_mile;
  const configured = num(econ.purchase_price) > 0 || num(econ.tire_set_cost) > 0;

  const base = {
    morning:
      mode === "riding"
        ? "Hotel curb or transit hub for fastest morning matches."
        : "Airport + hotel corridors first — early flight banks pay.",
    lunch:
      mode === "riding"
        ? "Downtown towers and restaurant strips have short waits."
        : "Restaurant row + downtown offices for stacked short trips.",
    afternoon:
      mode === "riding"
        ? "Mall and hospital entrances are steady."
        : "Position near hospitals and strip malls before dinner rush — skip scrap offers.",
    dinner:
      mode === "riding"
        ? "Restaurant curbs after 5pm — busiest pickup windows."
        : "Food corridors 5–9pm — highest stack potential. Protect your $/mi floor.",
    late:
      mode === "riding"
        ? "Nightlife districts after 10pm match fastest."
        : "Nightlife and late grocery — keep gas topped and deny long deadheads.",
  };

  const lines = [];
  lines.push(base[dayPart] || base.dinner);

  if (rushObj?.id === "afternoon") {
    lines.push("Afternoon slow: only take offers that clearly clear your all-in floor.");
  } else if (["lunch", "dinner"].includes(rushObj?.id)) {
    lines.push(`${rushObj.label} is live — favor short stacks that beat ${money(need)}/mi.`);
  }

  if (!configured) {
    lines.push("Set vehicle paid $ + tire set in Money autopilot so Titan uses your real cost/mi.");
  } else {
    lines.push(`Your all-in floor is ~${money(need)}/mi (fuel + maint + tires + vehicle).`);
  }

  if (weekSummary?.avg_dollars_per_hour != null && weekSummary.avg_dollars_per_hour > 0) {
    lines.push(`This week you’re averaging ~$${Math.round(weekSummary.avg_dollars_per_hour)}/hr when payouts are logged.`);
  }

  if (userId) {
    const moneyStats = summarizeMoneyProtected(userId);
    if (moneyStats?.decisions >= 3 && moneyStats.estimated_protected_usd > 0) {
      lines.push(
        `Autopilot has helped skip ~$${moneyStats.estimated_protected_usd} of weak offers recently.`
      );
    }
  }

  return {
    tip: lines[0],
    detail: lines.slice(1).join(" "),
    full: lines.join(" "),
    need_per_mile: need,
    rush: rushObj,
    true_cost_per_mile: floor.true_cost_per_mile,
  };
}

/**
 * Intelligence-tab money snapshot for hero polish.
 */
export function buildCoachMoneySnapshot({
  userId = null,
  mpg = 22,
  gasUsd = 3.5,
  economics = null,
  weekSummary = null,
  todaySummary = null,
} = {}) {
  const econ = economics || (userId ? readVehicleEconomics(userId) : {});
  const cost = computeTrueCostPerMile(econ, { mpg, gasUsd });
  const floor = ultimateWorthPerMile({
    economics: econ,
    mpg,
    gasUsd,
    parking: 0,
    totalMiles: 5,
    userId,
  });
  const loggedMi = num(weekSummary?.avg_dollars_per_mile);
  const gap =
    loggedMi > 0 ? mileMarginVsFloor(loggedMi, floor.recommended_min_gross_per_mile) : null;
  const configured = num(econ.purchase_price) > 0 || num(econ.tire_set_cost) > 0;

  return {
    configured,
    true_cost_per_mile: cost.true_cost_per_mile,
    need_per_mile: floor.recommended_min_gross_per_mile,
    maintenance_cents: cost.maintenance_cents,
    week_avg_per_mile: loggedMi || null,
    week_clears_floor: gap?.clears ?? null,
    week_margin: gap?.margin ?? null,
    today_earnings: num(todaySummary?.earnings),
    today_profit: num(todaySummary?.profit),
    tip: configured
      ? `Need ≥ ${money(floor.recommended_min_gross_per_mile)}/mi gross to cover all-in costs.`
      : "Add what you paid for the vehicle + tire set so ACCEPT/DENY uses your real $/mi.",
  };
}
