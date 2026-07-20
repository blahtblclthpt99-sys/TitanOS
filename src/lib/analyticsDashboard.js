/**
 * Analytics dashboard metrics — activity, engagement, growth, performance.
 * Composes entity data already loaded by the app (local-first friendly).
 */
import { formatCurrency, formatPercentChange } from "@/lib/formatCurrency";
import { currentMonthKey, todayISO, thisWeekRange, addDaysISO } from "@/lib/date-utils";

function dayKey(iso) {
  return String(iso || "").slice(0, 10);
}

function monthKey(iso) {
  return String(iso || "").slice(0, 7);
}

/**
 * Build a complete analytics snapshot for the Analytics page.
 */
export function buildAnalyticsDashboard({
  jobs = [],
  invoices = [],
  estimates = [],
  customers = [],
  notifications = [],
  messagesUnread = 0,
} = {}) {
  const today = todayISO();
  const month = currentMonthKey();
  const { start: weekStart, end: weekEnd } = thisWeekRange();
  const last7 = addDaysISO(-6);

  const jobsToday = jobs.filter((j) => j.scheduled_date === today && j.status !== "cancelled");
  const jobsWeek = jobs.filter((j) => {
    const d = j.scheduled_date || "";
    return d >= weekStart && d <= weekEnd && j.status !== "cancelled";
  });
  const completedWeek = jobs.filter((j) => {
    const d = dayKey(j.completed_at || j.updated_date || j.scheduled_date);
    return j.status === "completed" && d >= weekStart && d <= weekEnd;
  });
  const inProgress = jobs.filter((j) => j.status === "in_progress");

  const paidMonth = invoices.filter(
    (i) => i.status === "paid" && monthKey(i.paid_at || i.created_date) === month
  );
  const paidPrevMonth = invoices.filter((i) => {
    const key = monthKey(i.paid_at || i.created_date);
    const [y, m] = month.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return i.status === "paid" && key === prev;
  });
  const overdue = invoices.filter((i) => i.status === "overdue");
  const pendingEst = estimates.filter((e) => ["sent", "viewed"].includes(e.status));

  const monthRevenue = paidMonth.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const prevRevenue = paidPrevMonth.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const revenueTrend = formatPercentChange(monthRevenue, prevRevenue);

  const newCustomersMonth = customers.filter((c) => monthKey(c.created_date || c.created_at) === month);
  const newCustomersPrev = customers.filter((c) => {
    const [y, m] = month.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return monthKey(c.created_date || c.created_at) === prev;
  });
  const customerTrend = formatPercentChange(newCustomersMonth.length, newCustomersPrev.length || 1);

  // Activity sparkline — jobs scheduled per day (last 7)
  const activitySeries = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDaysISO(i - 6);
    const count = jobs.filter((j) => j.scheduled_date === d && j.status !== "cancelled").length;
    activitySeries.push({ date: d, label: d.slice(5), value: count });
  }

  // Revenue sparkline — paid totals last 7 days
  const revenueSeries = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDaysISO(i - 6);
    const total = invoices
      .filter((inv) => inv.status === "paid" && dayKey(inv.paid_at || inv.created_date) === d)
      .reduce((s, inv) => s + (Number(inv.total) || 0), 0);
    revenueSeries.push({ date: d, label: d.slice(5), value: total });
  }

  const unreadNotifs = notifications.filter((n) => !n.read_at);
  const recentActions = [
    ...jobs
      .slice()
      .sort((a, b) => new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0))
      .slice(0, 4)
      .map((j) => ({
        id: `job-${j.id}`,
        type: "job",
        title: j.title || j.customer_name || "Job update",
        meta: j.status,
        at: j.updated_date || j.created_date,
        path: "/jobs",
      })),
    ...invoices
      .slice()
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
      .slice(0, 3)
      .map((inv) => ({
        id: `inv-${inv.id}`,
        type: "invoice",
        title: inv.customer_name || "Invoice",
        meta: inv.status,
        at: inv.created_date,
        path: "/invoices",
      })),
    ...unreadNotifs.slice(0, 3).map((n) => ({
      id: `notif-${n.id}`,
      type: "notification",
      title: n.title,
      meta: n.type || "alert",
      at: n.created_at || n.created_date,
      path: n.link || "/notifications",
    })),
  ]
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 8);

  const completionRate = jobsWeek.length
    ? Math.round((completedWeek.length / jobsWeek.length) * 100)
    : 0;

  const engagementScore = Math.min(
    100,
    Math.round(
      (jobsToday.length > 0 ? 25 : 0) +
        (completedWeek.length > 0 ? 20 : 0) +
        (paidMonth.length > 0 ? 20 : 0) +
        (newCustomersMonth.length > 0 ? 15 : 0) +
        (unreadNotifs.length < 5 ? 10 : 5) +
        (messagesUnread === 0 ? 10 : 5)
    )
  );

  return {
    kpis: [
      {
        id: "activity",
        label: "User activity",
        value: jobsToday.length,
        hint: `${jobsWeek.length} jobs this week`,
        path: "/jobs",
      },
      {
        id: "engagement",
        label: "Engagement",
        value: engagementScore,
        suffix: "/100",
        hint: `${completedWeek.length} completed this week`,
        path: "/reports",
      },
      {
        id: "growth",
        label: "Growth",
        value: newCustomersMonth.length,
        hint: `${customerTrend.label} vs last month`,
        trend: customerTrend.direction,
        path: "/customers",
      },
      {
        id: "performance",
        label: "Performance",
        value: completionRate,
        suffix: "%",
        hint: "Job completion rate (week)",
        path: "/jobs",
      },
    ],
    revenue: {
      month: monthRevenue,
      monthLabel: formatCurrency(monthRevenue),
      trend: revenueTrend,
      overdueCount: overdue.length,
      overdueTotal: overdue.reduce((s, i) => s + (Number(i.balance_due || i.total) || 0), 0),
      pendingEstimates: pendingEst.length,
    },
    activitySeries,
    revenueSeries,
    notifications: {
      unread: unreadNotifs.length,
      total: notifications.length,
      recent: unreadNotifs.slice(0, 5),
    },
    recentActions,
    trends: [
      {
        id: "rev",
        label: "Revenue",
        change: revenueTrend.label,
        direction: revenueTrend.direction,
        detail: formatCurrency(monthRevenue),
      },
      {
        id: "cust",
        label: "New customers",
        change: customerTrend.label,
        direction: customerTrend.direction,
        detail: String(newCustomersMonth.length),
      },
      {
        id: "jobs",
        label: "Active jobs",
        change: `${inProgress.length} live`,
        direction: inProgress.length > 2 ? "up" : "flat",
        detail: `${jobsToday.length} today`,
      },
    ],
    last7,
  };
}
