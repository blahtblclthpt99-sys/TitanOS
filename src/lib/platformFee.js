/** TitanOS platform fee on in-app payment transactions. */
export const PLATFORM_FEE_RATE = 0.0076;
export const PLATFORM_FEE_PERCENT_LABEL = "0.76%";

/**
 * @param {number|string} amount - invoice / base amount in dollars
 * @returns {{ base: number, fee: number, total: number, rate: number, percentLabel: string }}
 */
export function calcPlatformFee(amount) {
  const base = Math.round((Number(amount) || 0) * 100) / 100;
  const fee = Math.round(base * PLATFORM_FEE_RATE * 100) / 100;
  const total = Math.round((base + fee) * 100) / 100;
  return {
    base,
    fee,
    total,
    rate: PLATFORM_FEE_RATE,
    percentLabel: PLATFORM_FEE_PERCENT_LABEL,
  };
}

export function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}
