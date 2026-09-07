/**
 * Runs due scheduled exports while the app is open (honest local cadence).
 */
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useVisibilityInterval } from "@/hooks/useVisibilityInterval";
import { popDueScheduledReports } from "@/lib/export/schedule";
import { runExport } from "@/lib/export/runExport";
import {
  jobsExportSpec,
  customersExportSpec,
  invoicesExportSpec,
  expensesExportSpec,
  financesExportSpec,
  analyticsExportSpec,
  reportsPackSpec,
} from "@/lib/export/moduleSpecs";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/api/apiClient";

async function buildSpec(moduleId) {
  if (moduleId === "jobs") {
    const rows = await api.entities.Job.list("-scheduled_date", 200).catch(() => []);
    return jobsExportSpec(rows);
  }
  if (moduleId === "customers") {
    const rows = await api.entities.Customer.list("-created_date", 200).catch(() => []);
    return customersExportSpec(rows);
  }
  if (moduleId === "invoices") {
    const rows = await api.entities.Invoice.list("-created_date", 200).catch(() => []);
    return invoicesExportSpec(rows);
  }
  if (moduleId === "expenses") {
    const rows = await api.entities.Expense.list("-date", 200).catch(() => []);
    return expensesExportSpec(rows);
  }
  if (moduleId === "finances") {
    const [invoices, expenses] = await Promise.all([
      api.entities.Invoice.list("-created_date", 200).catch(() => []),
      api.entities.Expense.list("-date", 200).catch(() => []),
    ]);
    return financesExportSpec(invoices, expenses);
  }
  if (moduleId === "analytics") {
    return analyticsExportSpec({
      kpis: [{ label: "Scheduled analytics export", value: new Date().toLocaleString(), hint: "Open Analytics for live KPIs" }],
    });
  }
  if (moduleId === "reports") {
    const [jobs, customers, invoices, expenses] = await Promise.all([
      api.entities.Job.list("-created_date", 200).catch(() => []),
      api.entities.Customer.list("-created_date", 200).catch(() => []),
      api.entities.Invoice.list("-created_date", 200).catch(() => []),
      api.entities.Expense.list("-date", 200).catch(() => []),
    ]);
    const paid = invoices.filter((i) => i.status === "paid");
    return reportsPackSpec({ paidInvoices: paid, expenses, jobs, cohorts: [] });
  }
  return null;
}

export default function ScheduledExportRunner() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const running = useRef(false);

  const tick = useCallback(async () => {
    if (!userId || running.current) return;
    const due = popDueScheduledReports(userId);
    if (!due.length) return;

    running.current = true;
    try {
      for (const job of due) {
        const spec = await buildSpec(job.moduleId);
        if (!spec) continue;
        const result = await runExport(spec, job.format || "csv", { userId });
        toast({
          title: result.ok ? `Scheduled: ${job.title || job.moduleId}` : "Scheduled export skipped",
          description: result.ok
            ? `${(job.format || "csv").toUpperCase()} ready${job.email ? ` · email not sent yet (${job.email})` : ""}`
            : result.reason,
          variant: result.ok ? "default" : "destructive",
        });
      }
    } finally {
      running.current = false;
    }
  }, [userId]);

  // Run once when an authenticated shell appears.
  useEffect(() => {
    if (!userId) return;
    void tick();
  }, [userId, tick]);

  // No background wakeups while the app is hidden. When it becomes visible,
  // check immediately so overdue reports do not wait for the next minute tick.
  useEffect(() => {
    if (!userId || typeof document === "undefined") return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [userId, tick]);

  useVisibilityInterval(tick, 60_000, { enabled: Boolean(userId) });

  return null;
}
