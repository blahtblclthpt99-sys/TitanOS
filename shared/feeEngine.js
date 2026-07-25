/**
 * TitanOS Fee Engine — pure calculation (no I/O).
 * Single source of truth for fee math. Server must run this for money moves;
 * client may use for display/preview only.
 *
 * KEEP SHARED: imported by api/_lib and tests; mirrored for Vite via src/lib/feeEngine.js re-export path.
 */

/** Round money to 2 decimal places (half-up via integer cents). */
export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatFeePercent(rate) {
  const r = Number(rate) || 0;
  if (r === 0) return "0%";
  const pct = r * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2).replace(/\.?0+$/, "")}%`;
}

/**
 * Resolve percentage from flat rate or tiers.
 * tiers: [{ min, max?, rate }] amounts in currency units; max null = open-ended.
 */
export function resolvePercentageRate(gross, rule) {
  const tiers = Array.isArray(rule?.tiers) ? rule.tiers : [];
  if (rule?.rule_type === "tiered" && tiers.length) {
    const g = Number(gross) || 0;
    const match = tiers.find((t) => {
      const min = Number(t.min) || 0;
      const max = t.max == null || t.max === "" ? Infinity : Number(t.max);
      return g >= min && g <= max;
    });
    if (match) return Number(match.rate) || 0;
  }
  return Number(rule?.percentage_rate) || 0;
}

function applyPromo(platformFee, rule, now = new Date()) {
  const promo = rule?.promo;
  if (!promo || typeof promo !== "object") {
    return { fee: platformFee, promoApplied: null };
  }
  if (promo.ends_at && new Date(promo.ends_at) < now) {
    return { fee: platformFee, promoApplied: null };
  }
  if (promo.starts_at && new Date(promo.starts_at) > now) {
    return { fee: platformFee, promoApplied: null };
  }
  let fee = platformFee;
  if (promo.percent_off != null) {
    fee = roundMoney(fee * (1 - Number(promo.percent_off)));
  }
  if (promo.amount_off != null) {
    fee = roundMoney(Math.max(0, fee - Number(promo.amount_off)));
  }
  return { fee, promoApplied: promo };
}

/**
 * Calculate all fee components for a transaction.
 *
 * @param {object} input
 * @param {number} input.grossAmount — seller/service base amount
 * @param {object} input.rule — fee rule row (or seed shape)
 * @param {Date} [input.now]
 * @returns {object} breakdown + appliedRules
 */
export function calculateFees({ grossAmount, rule, now = new Date() }) {
  if (!rule || rule.enabled === false) {
    const gross = roundMoney(grossAmount);
    return {
      gross,
      platformFee: 0,
      processingFee: 0,
      taxAmount: 0,
      netAmount: gross,
      finalTotal: gross,
      feeBearer: "buyer",
      rate: 0,
      label: "0%",
      appliedRules: [{ type: "disabled_or_missing", detail: "No active fee rule" }],
      feeVersion: rule?.version ?? null,
      feeRuleId: rule?.id ?? null,
      categoryId: rule?.category_id ?? null,
      contextKey: rule?.context_key ?? null,
    };
  }

  const gross = roundMoney(grossAmount);
  if (gross < 0) {
    throw new Error("grossAmount must be >= 0");
  }

  const appliedRules = [];
  const ruleType = rule.rule_type || "percentage";
  let platformFee = 0;
  let rate = 0;

  if (ruleType === "flat") {
    platformFee = roundMoney(rule.flat_amount);
    appliedRules.push({ type: "flat", amount: platformFee });
  } else if (ruleType === "composite") {
    rate = resolvePercentageRate(gross, rule);
    const pctPart = roundMoney(gross * rate);
    const flatPart = roundMoney(rule.flat_amount);
    platformFee = roundMoney(pctPart + flatPart);
    appliedRules.push({ type: "composite", rate, pctPart, flatPart });
  } else {
    // percentage or tiered
    rate = resolvePercentageRate(gross, { ...rule, rule_type: ruleType === "tiered" ? "tiered" : rule.rule_type });
    platformFee = roundMoney(gross * rate);
    appliedRules.push({
      type: ruleType === "tiered" ? "tiered_percentage" : "percentage",
      rate,
      amount: platformFee,
    });
  }

  if (rule.min_fee != null && platformFee < Number(rule.min_fee)) {
    platformFee = roundMoney(rule.min_fee);
    appliedRules.push({ type: "min_fee", amount: platformFee });
  }
  if (rule.max_fee != null && platformFee > Number(rule.max_fee)) {
    platformFee = roundMoney(rule.max_fee);
    appliedRules.push({ type: "max_fee", amount: platformFee });
  }

  const promoResult = applyPromo(platformFee, rule, now);
  platformFee = promoResult.fee;
  if (promoResult.promoApplied) {
    appliedRules.push({ type: "promo", promo: promoResult.promoApplied, amount: platformFee });
  }

  const processingFee = roundMoney(
    gross * (Number(rule.processing_fee_rate) || 0) + (Number(rule.processing_fee_flat) || 0)
  );
  if (processingFee > 0) {
    appliedRules.push({ type: "processing", amount: processingFee });
  }

  let taxAmount = 0;
  if (rule.tax_enabled && Number(rule.tax_rate) > 0) {
    // Tax on gross + platform fee (buyer-pays model)
    taxAmount = roundMoney((gross + platformFee) * Number(rule.tax_rate));
    appliedRules.push({ type: "tax", rate: Number(rule.tax_rate), amount: taxAmount });
  }

  const feeBearer = rule.fee_bearer === "seller" ? "seller" : "buyer";
  let finalTotal;
  let netAmount;

  if (feeBearer === "seller") {
    // Customer pays gross (+ processing + tax); platform takes fee from seller
    finalTotal = roundMoney(gross + processingFee + taxAmount);
    netAmount = roundMoney(gross - platformFee);
  } else {
    // Buyer pays fee on top (current TitanOS payments model)
    finalTotal = roundMoney(gross + platformFee + processingFee + taxAmount);
    netAmount = gross;
  }

  const label =
    rule.label ||
    (ruleType === "flat" ? `$${platformFee.toFixed(2)}` : formatFeePercent(rate));

  return {
    gross,
    platformFee,
    processingFee,
    taxAmount,
    netAmount,
    finalTotal,
    feeBearer,
    rate,
    label,
    appliedRules,
    feeVersion: rule.version ?? null,
    feeRuleId: rule.id ?? null,
    categoryId: rule.category_id ?? null,
    contextKey: rule.context_key ?? null,
  };
}

/** Seed defaults — used when DB unavailable. Must match plan.js launch rates. */
export const FEE_SEED_RULES = Object.freeze([
  {
    id: "seed-sr-customer",
    category_id: "service_requests",
    context_key: "customer",
    version: 1,
    label: "Customer 0%",
    enabled: true,
    rule_type: "percentage",
    percentage_rate: 0,
    flat_amount: 0,
    fee_bearer: "buyer",
  },
  {
    id: "seed-sr-worker-free",
    category_id: "service_requests",
    context_key: "worker_free",
    version: 1,
    label: "Worker Free 8%",
    enabled: true,
    rule_type: "percentage",
    percentage_rate: 0.08,
    flat_amount: 0,
    fee_bearer: "buyer",
  },
  {
    id: "seed-sr-worker-premium",
    category_id: "service_requests",
    context_key: "worker_premium",
    version: 1,
    label: "Worker Premium 2.5%",
    enabled: true,
    rule_type: "percentage",
    percentage_rate: 0.025,
    flat_amount: 0,
    fee_bearer: "buyer",
  },
  {
    id: "seed-sr-business",
    category_id: "service_requests",
    context_key: "business",
    version: 1,
    label: "Business 1.5%",
    enabled: true,
    rule_type: "percentage",
    percentage_rate: 0.015,
    flat_amount: 0,
    fee_bearer: "buyer",
  },
  {
    id: "seed-marketplace",
    category_id: "marketplace_sales",
    context_key: "*",
    version: 1,
    label: "Marketplace default 8%",
    enabled: true,
    rule_type: "percentage",
    percentage_rate: 0.08,
    flat_amount: 0,
    fee_bearer: "buyer",
  },
  {
    id: "seed-featured",
    category_id: "featured_listings",
    context_key: "*",
    version: 1,
    label: "Featured listing $9.99",
    enabled: true,
    rule_type: "flat",
    percentage_rate: 0,
    flat_amount: 9.99,
    fee_bearer: "buyer",
  },
]);

export function pickSeedRule(categoryId, contextKey = "*") {
  const exact = FEE_SEED_RULES.find(
    (r) => r.category_id === categoryId && r.context_key === contextKey && r.enabled
  );
  if (exact) return exact;
  return (
    FEE_SEED_RULES.find((r) => r.category_id === categoryId && r.context_key === "*" && r.enabled) ||
    null
  );
}
