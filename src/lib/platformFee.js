import { getPlanConfig, PLANS } from "@/lib/plan";

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
 * @param {number|string} amount
 * @param {object|string} [userOrPlanId]
 */
export function calcPlatformFee(amount, userOrPlanId = "worker_free") {
  const plan = getPlanConfig(userOrPlanId);
  const rate = plan.feeRate;
  const base = Math.round((Number(amount) || 0) * 100) / 100;
  const fee = Math.round(base * rate * 100) / 100;
  const total = Math.round((base + fee) * 100) / 100;
  return {
    base,
    fee,
    total,
    rate,
    percentLabel: plan.feeLabel,
    planId: plan.id,
    planName: plan.name,
  };
}

export function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}
