/**
 * Shared JSDoc types for Analytics & dashboard metrics.
 * Kept as comments so checkJs can validate call sites without a TS migration.
 */

/**
 * @typedef {'up'|'down'|'flat'} TrendDirection
 */

/**
 * @typedef {Object} TrendChip
 * @property {number} value
 * @property {string} label
 * @property {TrendDirection} direction
 */

/**
 * @typedef {Object} AnalyticsKpi
 * @property {string} id
 * @property {string} label
 * @property {number} value
 * @property {string} [suffix]
 * @property {string} [hint]
 * @property {TrendDirection} [trend]
 * @property {string} path
 */

/**
 * @typedef {Object} AnalyticsSnapshot
 * @property {AnalyticsKpi[]} kpis
 * @property {{ month: number, monthLabel: string, trend: TrendChip, overdueCount: number, overdueTotal: number, pendingEstimates: number }} revenue
 * @property {{ date: string, label: string, value: number }[]} activitySeries
 * @property {{ date: string, label: string, value: number }[]} revenueSeries
 * @property {{ unread: number, total: number, recent: object[] }} notifications
 * @property {{ id: string, type: string, title: string, meta?: string, at?: string, path: string }[]} recentActions
 * @property {{ id: string, label: string, change: string, direction: TrendDirection, detail?: string }[]} trends
 */

export {};
