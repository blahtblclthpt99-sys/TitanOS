import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Briefcase, FileText, Phone, Zap } from "lucide-react";
import { entityQueryKey, fetchEntity, ENTITY_STALE_TIME } from "@/lib/entity-query";
import {
  todayISO,
  currentMonthKey,
  prevMonthRange,
  relativeTime,
  thisWeekRange,
  addDaysISO,
} from "@/lib/date-utils";

import { DASHBOARD_QUERIES } from "@/lib/dashboard-queries";

function buildDashboardData(jobs, invoices, estimates, customers, employees) {
  const today = todayISO();
  const { start: prevMonthStart, end: prevMonthEnd } = prevMonthRange();
  const { start: weekStart, end: weekEnd } = thisWeekRange();
  const nextWeekEnd = addDaysISO(7);

  const todayJobs = jobs
    .filter((j) => j.scheduled_date === today)
    .sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));
  const upcomingJobs = jobs
    .filter((j) => j.scheduled_date > today && j.scheduled_date <= nextWeekEnd && j.status !== "cancelled")
    .sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""))
    .slice(0, 6);
  const inProgressJobs = jobs.filter((j) => j.status === "in_progress");
  const overdueInv = invoices.filter((i) => i.status === "overdue");
  const pendingInv = invoices.filter((i) => ["sent", "viewed"].includes(i.status));
  const pendingEst = estimates.filter((e) => ["sent", "viewed"].includes(e.status));
  const recentCust = customers.slice(0, 5).map((c) => ({
    ...c,
    name:
      c.name ||
      [c.first_name, c.last_name].filter(Boolean).join(" ") ||
      c.company_name ||
      "Customer",
  }));
  const recentPaid = invoices
    .filter((i) => i.status === "paid")
    .slice(0, 5);

  const thisMonthKey = currentMonthKey();
  const thisMonthPaid = invoices.filter(
    (i) => i.status === "paid" && (i.created_date || "").slice(0, 7) === thisMonthKey
  );
  const prevMonthPaid = invoices.filter((i) => {
    const d = (i.created_date || "").slice(0, 10);
    return i.status === "paid" && d >= prevMonthStart && d <= prevMonthEnd;
  });
  const weekPaid = invoices.filter((i) => {
    const d = (i.paid_at || i.created_date || i.created_at || "").slice(0, 10);
    return i.status === "paid" && d >= weekStart && d <= weekEnd;
  });
  const monthRevenue = thisMonthPaid.reduce((s, i) => s + (i.total || 0), 0);
  const prevMonthRevenue = prevMonthPaid.reduce((s, i) => s + (i.total || 0), 0);
  const weekRevenue = weekPaid.reduce((s, i) => s + (i.total || 0), 0);

  const todayRevenue = todayJobs
    .filter((j) => j.status === "completed")
    .reduce((s, j) => s + (j.amount || 0), 0);
  const pipelineToday = todayJobs
    .filter((j) => j.status !== "cancelled")
    .reduce((s, j) => s + (j.amount || 0), 0);
  const overdueTotal = overdueInv.reduce((s, i) => s + (i.balance_due || i.total || 0), 0);

  const nextActions = [];
  if (overdueInv.length > 0) {
    const top = overdueInv[0];
    nextActions.push({
      icon: Phone,
      text: `Follow up with ${top.customer_name || "customer"}`,
      sub: `Invoice overdue · $${(top.balance_due || top.total || 0).toLocaleString()}`,
      cta: "Call",
      path: "/invoices",
    });
  }
  if (pendingEst.length > 0) {
    const top = pendingEst[0];
    nextActions.push({
      icon: FileText,
      text: `Chase estimate for ${top.customer_name || "customer"}`,
      sub: `Sent · $${(top.total || 0).toLocaleString()} · expires ${top.valid_until ? relativeTime(top.valid_until) : "soon"}`,
      cta: "View",
      path: "/estimates",
    });
  }
  if (inProgressJobs.length > 0) {
    const top = inProgressJobs[0];
    nextActions.push({
      icon: Briefcase,
      text: `Update status: ${top.title}`,
      sub: `${top.assigned_name || "Unassigned"} · in progress`,
      cta: "Update",
      path: "/jobs",
    });
  }
  if (nextActions.length === 0) {
    nextActions.push({
      icon: Zap,
      text: "Create your first estimate",
      sub: "Turn leads into revenue",
      cta: "Go",
      path: "/estimates?new=1",
    });
  }

  const outstandingTotal = [...overdueInv, ...pendingInv].reduce(
    (s, i) => s + (i.balance_due || i.total || 0),
    0
  );

  return {
    jobs,
    invoices,
    estimates,
    customers,
    todayJobs,
    upcomingJobs,
    inProgressJobs,
    overdueInv,
    pendingInv,
    pendingEst,
    monthRevenue,
    prevMonthRevenue,
    weekRevenue,
    todayRevenue,
    pipelineToday,
    overdueTotal,
    outstandingTotal,
    nextActions,
    recentCust,
    recentPaid,
    topPendingEst: pendingEst[0] || null,
    totalCustomers: customers.length,
    activeEmployees: employees.filter((e) => e.status === "active").length,
  };
}

export function useDashboardData({ enabled = true } = {}) {
  const queryClient = useQueryClient();

  const queries = useQueries({
    queries: DASHBOARD_QUERIES.map((descriptor) => ({
      queryKey: entityQueryKey(descriptor),
      queryFn: () => fetchEntity(descriptor),
      enabled,
      staleTime: ENTITY_STALE_TIME,
    })),
  });

  const jobs = queries[0]?.data;
  const invoices = queries[1]?.data;
  const estimates = queries[2]?.data;
  const customers = queries[3]?.data;
  const employees = queries[4]?.data;

  const loading = Boolean(enabled && queries.some((query) => query.isPending));
  const anyLoaded = [jobs, invoices, estimates, customers, employees].some((row) => row !== undefined);
  const allFailed =
    !loading &&
    queries.length > 0 &&
    queries.every((query) => Boolean(query.error)) &&
    !anyLoaded;
  const error = allFailed ? queries.find((query) => query.error)?.error ?? null : null;
  const partialError =
    anyLoaded && queries.some((query) => query.error)
      ? queries.find((query) => query.error)?.error ?? null
      : null;

  const data = useMemo(() => {
    if (!anyLoaded) return null;
    return buildDashboardData(
      jobs ?? [],
      invoices ?? [],
      estimates ?? [],
      customers ?? [],
      employees ?? []
    );
  }, [anyLoaded, jobs, invoices, estimates, customers, employees]);

  const reload = async () => {
    await Promise.all(
      DASHBOARD_QUERIES.map((descriptor) =>
        queryClient.invalidateQueries({ queryKey: entityQueryKey(descriptor) })
      )
    );
  };

  return { data, loading, error, partialError, reload };
}
