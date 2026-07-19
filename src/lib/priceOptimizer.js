/**
 * AI Price Optimizer factors — zip, season, competition, job size.
 * Plugs into estimateJobPrice via market_rate_factor + explanation.
 */

const ZIP_REGION_ADJ = {
  // First digit of ZIP → rough COL / market pressure
  0: 1.12, // Northeast dense
  1: 1.1,
  2: 1.05,
  3: 0.95, // South
  4: 0.97,
  5: 0.94,
  6: 0.98,
  7: 0.96,
  8: 1.02, // Mountain / West
  9: 1.18, // CA/WA high COL
};

const SEASON_BY_MONTH = {
  // month index 0-11 → seasonal demand multiplier for outdoor-heavy trades
  outdoor_peak: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) =>
    m >= 3 && m <= 9 ? 1.12 : m === 2 || m === 10 ? 1.05 : 0.92
  ),
  hvac: [1.25, 1.2, 1.05, 0.95, 0.9, 1.15, 1.3, 1.28, 1.05, 0.95, 1.05, 1.2],
  default: Array(12).fill(1),
};

const COMPETITION_HINTS = {
  high: 0.92, // more competitors → tighter pricing
  medium: 1,
  low: 1.08, // scarce capacity → premium
};

function zipFactor(zip) {
  const digit = String(zip || "").replace(/\D/g, "")[0];
  if (digit == null) return { factor: 1, label: "National baseline" };
  const f = ZIP_REGION_ADJ[digit] || 1;
  return { factor: f, label: `ZIP ${String(zip).slice(0, 5)} market (${f >= 1 ? "+" : ""}${Math.round((f - 1) * 100)}%)` };
}

function seasonFactor(serviceType, date = new Date()) {
  const m = date.getMonth();
  const s = String(serviceType || "").toLowerCase();
  let series = SEASON_BY_MONTH.default;
  let label = "Flat seasonal demand";
  if (/hvac|air|heat|furnace|ac\b/.test(s)) {
    series = SEASON_BY_MONTH.hvac;
    label = "HVAC seasonal demand";
  } else if (/lawn|pressure|paint|roof|landscap|detail|junk|clean/.test(s)) {
    series = SEASON_BY_MONTH.outdoor_peak;
    label = "Outdoor/seasonal demand";
  }
  const factor = series[m] || 1;
  return { factor, label: `${label} (${factor >= 1 ? "+" : ""}${Math.round((factor - 1) * 100)}%)` };
}

function sizeFactor(hours, jobSize) {
  const h = Number(hours) || 0;
  if (jobSize === "large" || h >= 8) return { factor: 1.06, label: "Large job premium (+6%)" };
  if (jobSize === "small" || (h > 0 && h <= 1.5)) return { factor: 1.08, label: "Small-job trip premium (+8%)" };
  return { factor: 1, label: "Standard job size" };
}

function competitionFactor(level = "medium") {
  const factor = COMPETITION_HINTS[level] || 1;
  const label =
    level === "high"
      ? "High local competition (−8%)"
      : level === "low"
        ? "Low competition / scarce capacity (+8%)"
        : "Average local competition";
  return { factor, label };
}

/**
 * Compute optimized market factor + customer-facing price band explanation.
 */
export function optimizePriceFactors({
  zip,
  service_type,
  hours,
  job_size = "standard",
  competition = "medium",
  date,
} = {}) {
  const z = zipFactor(zip);
  const s = seasonFactor(service_type, date);
  const size = sizeFactor(hours, job_size);
  const c = competitionFactor(competition);
  const market_rate_factor = Math.round(z.factor * s.factor * size.factor * c.factor * 1000) / 1000;

  return {
    market_rate_factor,
    factors: [z, s, size, c],
    explanation: [z.label, s.label, size.label, c.label],
    competition,
    zip: String(zip || "").slice(0, 5),
  };
}

/** Map optimized factor onto an estimateJobPrice result with “why” copy. */
export function withPriceOptimization(estimate, factors) {
  const low = estimate.low_estimate;
  const high = estimate.premium_estimate;
  return {
    ...estimate,
    market_range: { low, high },
    optimization: factors,
    why_price: `Suggested $${estimate.suggested_price} sits in a local band of $${low}–$${high}. ${factors.explanation.join(" · ")}.`,
  };
}
