import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Briefcase, FileText, Phone, Zap } from "lucide-react";
import { entityQueryKey, fetchEntity, ENTITY_STALE_TIME } from "@/lib/entity-query";
import {
  todayISO,
  currentMonthKey,
  prevMonthRange,
  relativeTime,
} from "@/lib/date-utils";

import { DASHBOARD_QUERIES } from "@/lib/dashboard-queries";

function buildDashboardData(jobs, invoices, estimates, customers, employees) {
  const today = todayISO();
  const { start: prevMonthStart, end: prevMonthEnd } = prevMonthRange();

  const todayJobs = jobs.filter((j) => j.scheduled_date === today);
  const inProgressJobs = jobs.filter((j) => j.status === "in_progress");
  const overdueInv = invoices.filter((i) => i.status === "overdue");
  const pendingInv = invoices.filter((i) => ["sent", "viewed"].includes(i.status));
  const pendingEst = estimates.filter((e) => ["sent", "viewed"].includes(e.status));
  const recentCust = customers.slice(0, 3);

  const thisMonthKey = currentMonthKey();
  const thisMonthPaid = invoices.filter(
    (i) => i.status === "paid" && (i.created_date || "").slice(0, 7) === thisMonthKey
  );
  const prevMonthPaid = invoices.filter((i) => {
    const d = (i.created_date || "").slice(0, 10);
    return i.status === "paid" && d >= prevMonthStart && d <= prevMonthEnd;
  });
  const monthRevenue = thisMonthPaid.reduce((s, i) => s + (i.total || 0), 0);
  const prevMonthRevenue = prevMonthPaid.reduce((s, i) => s + (i.total || 0), 0);

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
      text: `Follow up with ${top.customer_name}`,
      sub: `Invoice overdue · $${(top.balance_due || top.total || 0).toLocaleString()}`,
      cta: "Call",
      path: "/invoices",
    });
  }
  if (pendingEst.length > 0) {
    const top = pendingEst[0];
    nextActions.push({
      icon: FileText,
      text: `Chase estimate for ${top.customer_name}`,
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
    todayJobs,
    inProgressJobs,
    overdueInv,
    pendingInv,
    pendingEst,
    monthRevenue,
    prevMonthRevenue,
    todayRevenue,
    pipelineToday,
    overdueTotal,
    outstandingTotal,
    nextActions,
    recentCust,
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

  const [jobs, invoices, estimates, customers, employees] = queries.map(
    (query) => query.data
  );

  const loading = enabled && queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.error)?.error ?? null;
  const isReady = [jobs, invoices, estimates, customers, employees].every(
    (result) => result !== undefined
  );

  const data = useMemo(() => {
    if (!isReady || error) return null;
    return buildDashboardData(
      jobs ?? [],
      invoices ?? [],
      estimates ?? [],
      customers ?? [],
      employees ?? []
    );
  }, [isReady, error, jobs, invoices, estimates, customers, employees]);

  const reload = async () => {
    await Promise.all(
      DASHBOARD_QUERIES.map((descriptor) =>
        queryClient.invalidateQueries({ queryKey: entityQueryKey(descriptor) })
      )
    );
  };

  return { data, loading, error, reload };
}
