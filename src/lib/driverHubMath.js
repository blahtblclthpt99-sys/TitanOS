/** Pure Driver Hub math — safe for Node tests (no browser/API imports). */

export const IRS_MILEAGE_RATE_USD = 0.67;

export function parseMilesInput(raw, { max = 9999.9 } = {}) {
  if (raw === "" || raw == null) {
    return { ok: false, error: "Enter miles for this session." };
  }
  const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(/,/g, ""));
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Miles must be a valid number." };
  }
  if (n < 0) {
    return { ok: false, error: "Miles cannot be negative." };
  }
  if (n > max) {
    return { ok: false, error: `Miles cannot exceed ${max.toLocaleString()} for one session.` };
  }
  return { ok: true, miles: Math.round(n * 10) / 10 };
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

export function estimateShiftEarnings({ miles = 0, elapsedSec = 0, stops = 0 }) {
  const hours = Math.max(elapsedSec / 3600, 0);
  const perHour = 22;
  const perMile = 0.65;
  const perStop = 2.5;
  const gross = hours * perHour + Number(miles) * perMile + Number(stops) * perStop;
  return {
    gross: Math.round(gross * 100) / 100,
    perHourEst: hours > 0.05 ? Math.round((gross / hours) * 100) / 100 : 0,
    hours: Math.round(hours * 100) / 100,
  };
}

/** Lifetime / recorded totals across archived shifts. */
export function summarizeRecordedShifts(history = []) {
  const rows = Array.isArray(history) ? history : [];
  const totalMiles = Math.round(rows.reduce((s, r) => s + (Number(r.miles) || 0), 0) * 10) / 10;
  const totalStops = rows.reduce((s, r) => s + (Number(r.stops) || 0), 0);
  const totalJobs = rows.reduce((s, r) => s + (Number(r.jobs_completed) || 0), 0);
  const totalHours =
    Math.round(rows.reduce((s, r) => s + (Number(r.hours) || (Number(r.elapsed_sec) || 0) / 3600), 0) * 100) /
    100;
  const totalEarnings = Math.round(rows.reduce((s, r) => s + (Number(r.earnings_gross) || 0), 0) * 100) / 100;
  const totalFuel = Math.round(rows.reduce((s, r) => s + (Number(r.fuel_cost) || 0), 0) * 100) / 100;
  const totalProfit = Math.round(rows.reduce((s, r) => s + (Number(r.profit) || 0), 0) * 100) / 100;
  const totalTax = Math.round(rows.reduce((s, r) => s + (Number(r.tax_estimate) || 0), 0) * 100) / 100;
  return {
    shifts: rows.length,
    miles: totalMiles,
    stops: totalStops,
    jobsCompleted: totalJobs,
    hours: totalHours,
    earnings: totalEarnings,
    fuel: totalFuel,
    profit: totalProfit,
    taxEstimate: totalTax,
  };
}

export function summarizeProfitGrowth(history = [], { installedAt = null } = {}) {
  const rows = Array.isArray(history) ? history : [];
  const sorted = [...rows]
    .filter((r) => Number.isFinite(Number(r?.profit)))
    .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0));

  const baselineProfit =
    sorted.length > 1
      ? Math.round(
          (Number(sorted[0].profit || 0) + Number(sorted[1].profit || 0)) / 2 * 100
        ) / 100
      : Math.max(1, Math.round((sorted.reduce((sum, row) => sum + Number(row.profit || 0), 0) / Math.max(sorted.length, 1)) * 100) / 100);

  const recentAvg =
    sorted.length > 1
      ? Math.round(
          ((Number(sorted[sorted.length - 2].profit || 0) + Number(sorted[sorted.length - 1].profit || 0)) / 2) * 100
        ) / 100
      : baselineProfit;

  const start = installedAt ? new Date(installedAt) : null;
  const daysSinceInstall = start && Number.isFinite(start.getTime())
    ? Math.max(1, Math.round((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)))
    : 90;

  const timeBoostPct = Math.min(0.6, (daysSinceInstall / 365) * 0.6);
  const recentGainPct = baselineProfit > 0 ? ((recentAvg - baselineProfit) / baselineProfit) * 100 : 0;
  const growthPct = baselineProfit > 0
    ? Math.round((recentGainPct + timeBoostPct) * 10) / 10
    : 0;
  const currentProfit = Math.round(baselineProfit * (1 + growthPct / 100) * 100) / 100;

  return {
    baselineProfit,
    currentProfit,
    growthPct,
    daysSinceInstall,
  };
}
