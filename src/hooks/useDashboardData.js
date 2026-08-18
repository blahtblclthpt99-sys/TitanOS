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

function buildDashboardData(jobs, invoices, estimates, customers) {
  const today = todayISO();
  const { start: prevMonthStart, end: prevMonthEnd } = prevMonthRange();
  const { start: weekStart, end: weekEnd } = thisWeekRange();
  const nextWeekEnd = addDaysISO(7);

  const todayJobs = jobs
    .filter((job) => job.scheduled_date === today)
    .sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));
  const upcomingJobs = jobs
    .filter((job) => job.scheduled_date > today && job.scheduled_date <= nextWeekEnd && job.status !== "cancelled")
    .sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""))
    .slice(0, 6);
  const inProgressJobs = jobs.filter((job) => job.status === "in_progress");
  const overdueInv = invoices.filter((invoice) => invoice.status === "overdue");
  const pendingInv = invoices.filter((invoice) => ["sent", "viewed"].includes(invoice.status));
  const pendingEst = estimates.filter((estimate) => ["sent", "viewed"].includes(estimate.status));

  const thisMonthKey = currentMonthKey();
  const thisMonthPaid = invoices.filter(
    (invoice) => invoice.status === "paid" && (invoice.created_date || "").slice(0, 7) === thisMonthKey
  );
  const prevMonthPaid = invoices.filter((invoice) => {
    const date = (invoice.created_date || "").slice(0, 10);
    return invoice.status === "paid" && date >= prevMonthStart && date <= prevMonthEnd;
  });
  const weekPaid = invoices.filter((invoice) => {
    const date = (invoice.updated_at || invoice.created_date || invoice.created_at || "").slice(0, 10);
    return invoice.status === "paid" && date >= weekStart && date <= weekEnd;
  });

  const monthRevenue = thisMonthPaid.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
  const prevMonthRevenue = prevMonthPaid.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
  const weekRevenue = weekPaid.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
  const todayRevenue = todayJobs
    .filter((job) => job.status === "completed")
    .reduce((sum, job) => sum + (job.amount || 0), 0);
  const pipelineToday = todayJobs
    .filter((job) => job.status !== "cancelled")
    .reduce((sum, job) => sum + (job.amount || 0), 0);
  const overdueTotal = overdueInv.reduce((sum, invoice) => sum + (invoice.balance_due || invoice.total || 0), 0);
  const outstandingTotal = [...overdueInv, ...pendingInv].reduce(
    (sum, invoice) => sum + (invoice.balance_due || invoice.total || 0),
    0
  );

  const nextActions = [];
  if (overdueInv.length > 0) {
    const top = overdueInv[0];
    nextActions.push({
      icon: Phone,
      text: `Follow up with ${top.customer_name || "customer"}`,
      sub: `Invoice overdue · $${(top.balance_due || top.total || 0).toLocaleString()}`,
      cta: "Open",
      path: "/invoices",
    });
  }
  if (pendingEst.length > 0) {
    const top = pendingEst[0];
    nextActions.push({
      icon: FileText,
      text: `Follow up on ${top.customer_name || "customer"}'s estimate`,
      sub: `Sent · $${(top.total || 0).toLocaleString()} · expires ${top.valid_until ? relativeTime(top.valid_until) : "soon"}`,
      cta: "Open",
      path: "/estimates",
    });
  }
  if (inProgressJobs.length > 0) {
    const top = inProgressJobs[0];
    nextActions.push({
      icon: Briefcase,
      text: `Update ${top.title || "job"}`,
      sub: `${top.assigned_name || "Unassigned"} · in progress`,
      cta: "Open",
      path: "/jobs",
    });
  }
  if (nextActions.length === 0) {
    nextActions.push({
      icon: Zap,
      text: "Create your next estimate",
      sub: "Turn a customer need into scheduled work",
      cta: "Create",
      path: "/estimates?new=1",
    });
  }

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
    topPendingEst: pendingEst[0] || null,
    totalCustomers: customers.length,
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
  const loadedValues = [jobs, invoices, estimates, customers];
  const loading = Boolean(enabled && queries.some((query) => query.isPending));
  const anyLoaded = loadedValues.some((value) => value !== undefined);
  const allFailed =
    !loading &&
    queries.length > 0 &&
    queries.every((query) => Boolean(query.error)) &&
    !anyLoaded;
  const error = allFailed ? queries.find((query) => query.error)?.error ?? null : null;
  const partialError =
    anyLoaded && queries.some((query) => query.error)
      ? (() => {
          const failed = DASHBOARD_QUERIES.filter((_, index) => queries[index]?.error).map((descriptor) => descriptor.entity);
          const first = queries.find((query) => query.error)?.error;
          const err = first ?? new Error("Partial load failed");
          err.message = failed.length
            ? `${failed.join(", ")} failed to load${first?.message ? `: ${first.message}` : ""}`
            : err.message;
          return err;
        })()
      : null;

  const data = useMemo(() => {
    if (!anyLoaded) return null;
    return buildDashboardData(jobs ?? [], invoices ?? [], estimates ?? [], customers ?? []);
  }, [anyLoaded, jobs, invoices, estimates, customers]);

  const reload = async () => {
    await Promise.all(
      DASHBOARD_QUERIES.map((descriptor) =>
        queryClient.invalidateQueries({ queryKey: entityQueryKey(descriptor) })
      )
    );
  };

  return { data, loading, error, partialError, reload };
}
