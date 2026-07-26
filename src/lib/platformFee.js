/**
 * Display helpers for platform fees.
 * WARNING: Never use client results to charge money — createPaymentLink recalculates server-side.
 */
import { getPlanConfig, PLANS } from "@/lib/plan";
import { calculateFees, formatFeePercent, pickSeedRule } from "@/lib/feeEngine";
export { formatMoney } from "@/lib/formatCurrency";

/** @deprecated Prefer calcPlatformFee(amount, user) */
export const PLATFORM_FEE_RATE = PLANS.worker_free.feeRate;
export const PLATFORM_FEE_PERCENT_LABEL = PLANS.worker_free.feeLabel;

export function getFeeRateForPlan(planIdOrUser) {
  return getPlanConfig(planIdOrUser).feeRate;
}

export function getFeeLabelForPlan(planIdOrUser) {
  return getPlanConfig(planIdOrUser).feeLabel;
}

/**
 * UI/preview fee estimate from Fee Engine + plan context seed/DB-compatible rules.
 * @param {number|string} amount
 * @param {object|string} [userOrPlanId]
 */
export function calcPlatformFee(amount, userOrPlanId = "worker_free") {
  const plan = getPlanConfig(userOrPlanId);
  const rule = pickSeedRule("service_requests", plan.id) || {
    category_id: "service_requests",
    context_key: plan.id,
    version: 1,
    enabled: true,
    rule_type: "percentage",
    percentage_rate: plan.feeRate,
    flat_amount: 0,
    fee_bearer: "buyer",
    label: plan.feeLabel,
  };

  // Prefer live plan rate if seed drifts (plan.js remains catalog for membership UX)
  const merged = {
    ...rule,
    percentage_rate: plan.feeRate,
    label: plan.feeLabel || formatFeePercent(plan.feeRate),
  };

  const result = calculateFees({ grossAmount: amount, rule: merged });
  return {
    base: result.gross,
    fee: result.platformFee,
    total: result.finalTotal,
    rate: result.rate,
    percentLabel: result.label,
    planId: plan.id,
    planName: plan.name,
    processingFee: result.processingFee,
    taxAmount: result.taxAmount,
    netAmount: result.netAmount,
    appliedRules: result.appliedRules,
    _displayOnly: true,
  };
}
