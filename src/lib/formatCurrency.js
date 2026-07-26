/**
 * Shared currency formatting — prefer this over ad-hoc toLocaleString / `$` templates.
 *
 * Policy:
 * - `formatCurrency` — dashboard/KPI display (whole dollars by default; use `cents: true` for fees)
 * - `formatMoney` — exact two-decimal money (payments, fees, invoices)
 */

/**
 * @param {number|string|null|undefined} amount
 * @param {{
 *   currency?: string,
 *   compact?: boolean,
 *   cents?: boolean,
 *   fractionDigits?: number,
 *   minimumFractionDigits?: number,
 * }} [opts]
 * @returns {string}
 */
export function formatCurrency(amount, opts = {}) {
  const value = Number(amount);
  const n = Number.isFinite(value) ? value : 0;
  const currency = opts.currency || "USD";
  const fractionDigits =
    opts.fractionDigits ??
    (opts.cents ? 2 : opts.compact ? 1 : 0);
  const minimumFractionDigits =
    opts.minimumFractionDigits ?? (opts.cents || fractionDigits === 2 ? 2 : 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits,
    }).format(n);
  } catch {
    return opts.cents || fractionDigits === 2
      ? `$${n.toFixed(2)}`
      : `$${Math.round(n).toLocaleString()}`;
  }
}

/**
 * Exact USD-style money for checkout / fee lines (always two fraction digits).
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatMoney(value) {
  return formatCurrency(value, { cents: true });
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
