/**
 * Shared currency formatting — prefer this over ad-hoc toLocaleString.
 */

/**
 * @param {number|string|null|undefined} amount
 * @param {{ currency?: string, compact?: boolean }} [opts]
 */
export function formatCurrency(amount, opts = {}) {
  const value = Number(amount);
  const n = Number.isFinite(value) ? value : 0;
  const currency = opts.currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: opts.compact ? 1 : 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

/** Percent change helper for trend chips. */
export function formatPercentChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (!prev) return { label: "—", direction: "flat", value: 0 };
  const value = Math.round(((cur - prev) / prev) * 100);
  return {
    value,
    label: `${value > 0 ? "+" : ""}${value}%`,
    direction: value > 0 ? "up" : value < 0 ? "down" : "flat",
  };
}
