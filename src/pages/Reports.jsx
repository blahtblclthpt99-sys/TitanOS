import React, { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, Briefcase, Receipt, DollarSign, ArrowDownRight, Download } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { useEntityData } from "@/hooks/useEntityData";
import { lastNMonthKeys } from "@/lib/date-utils";
import { sumPaidRevenue, sumExpenses, sumOutstanding } from "@/lib/finance-metrics";
import { buildCohorts, exportCsv } from "@/lib/advancedAnalytics";
import { formatCurrency } from "@/lib/formatCurrency";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const ReportsCharts = lazy(() => import("@/components/charts/ReportsCharts"));

export default function Reports() {
  const reduceMotion = usePrefersReducedMotion();
  const { data: [jobs, customers, invoices, expenses], loading, error, reload } = useEntityData([
    { entity: "Job", method: "list", args: ["-created_date", 200] },
    { entity: "Customer", method: "list", args: ["-created_date", 200] },
    { entity: "Invoice", method: "list", args: ["-created_date", 200] },
    { entity: "Expense", method: "list", args: ["-date", 200] },
  ]);

  if (loading) return <PageLoader variant="list" label="Loading reports" />;
  if (error) return <ErrorState title="Couldn't load reports" onRetry={reload} />;

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const outstanding = sumOutstanding(invoices);
  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const completionRate = jobs.length ? Math.round((completedJobs / jobs.length) * 100) : 0;
  const revenue = sumPaidRevenue(invoices);
  const totalExpenses = sumExpenses(expenses);
  const cohorts = buildCohorts(customers, invoices);
  const avgJobValue = completedJobs ? Math.round(revenue / Math.max(completedJobs, 1)) : 0;

  const monthMap = Object.fromEntries(
    lastNMonthKeys(6).map(({ key, label }) => [key, { month: label, revenue: 0, expenses: 0 }])
  );
  paidInvoices.forEach((inv) => {
    const k = (inv.created_date || "").slice(0, 7);
    if (monthMap[k]) monthMap[k].revenue += inv.total || 0;
  });
  expenses.forEach((exp) => {
    const k = (exp.date || "").slice(0, 7);
    if (monthMap[k]) monthMap[k].expenses += exp.amount || 0;
  });
  const monthlyData = Object.values(monthMap);

  const serviceRevMap = {};
  jobs.forEach((j) => {
    const key = j.service_type || "Other";
    serviceRevMap[key] = (serviceRevMap[key] || 0) + (j.amount || 0);
  });
  const serviceData = Object.entries(serviceRevMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const expCatMap = {};
  expenses.forEach((e) => {
    const key = e.category || "other";
    expCatMap[key] = (expCatMap[key] || 0) + (e.amount || 0);
  });
  const expCatData = Object.entries(expCatMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const statCards = [
    { icon: Briefcase, label: "Total Jobs", value: jobs.length, color: "text-titan-cyan", bg: "bg-titan-cyan/10" },
    { icon: Users, label: "Customers", value: customers.length, color: "text-titan-indigo", bg: "bg-titan-indigo/10" },
    { icon: DollarSign, label: "Revenue", value: formatCurrency(revenue), color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { icon: ArrowDownRight, label: "Expenses", value: formatCurrency(totalExpenses), color: "text-red-400", bg: "bg-red-400/10" },
    { icon: TrendingUp, label: "Completion Rate", value: `${completionRate}%`, color: "text-titan-cyan", bg: "bg-titan-cyan/10" },
    { icon: Receipt, label: "Outstanding", value: formatCurrency(outstanding), color: "text-titan-amber", bg: "bg-titan-amber/10" },
    { icon: DollarSign, label: "Avg job value", value: formatCurrency(avgJobValue), color: "text-emerald-300", bg: "bg-emerald-400/10" },
  ];

  const hasMonthly = monthlyData.some((d) => d.revenue > 0 || d.expenses > 0);
  const hasService = serviceData.length > 0;
  const hasExpCat = expCatData.length > 0;

  const downloadRevenue = () => {
    exportCsv("titanos-revenue.csv", paidInvoices, [
      { label: "Invoice", value: (r) => r.invoice_number || r.id },
      { label: "Customer", value: (r) => r.customer_name || r.customer_id || "" },
      { label: "Total", value: (r) => r.total || 0 },
      { label: "Date", value: (r) => (r.created_date || "").slice(0, 10) },
    ]);
  };

  return (
    <div className="page-pad max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <PageHeader title="Reports" subtitle="Business analytics & insights" />
        <Button type="button" onClick={downloadRevenue} variant="outline" className="border-border text-foreground">
          <Download className="w-4 h-4 mr-2" aria-hidden="true" /> Export paid CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { delay: i * 0.06 }}
            className="titan-surface p-5"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{card.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {cohorts.length > 0 && (
        <section className="glass rounded-2xl p-5 mb-6 border border-border">
          <h2 className="font-semibold text-foreground mb-3">Customer cohorts (by signup month)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Month</th>
                  <th className="py-2 pr-4">Customers</th>
                  <th className="py-2 pr-4">Paying</th>
                  <th className="py-2 pr-4">Conversion</th>
                  <th className="py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.month} className="border-b border-border/60 text-foreground">
                    <td className="py-2 pr-4">{c.month}</td>
                    <td className="py-2 pr-4">{c.customers}</td>
                    <td className="py-2 pr-4">{c.paying}</td>
                    <td className="py-2 pr-4">{c.conversion}%</td>
                    <td className="py-2">{formatCurrency(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Suspense fallback={<div className="h-96 rounded-2xl bg-muted animate-pulse mb-6" aria-busy="true" aria-label="Loading charts" />}>
        <ReportsCharts
          monthlyData={monthlyData}
          serviceData={serviceData}
          expCatData={expCatData}
          hasMonthly={hasMonthly}
          hasService={hasService}
          hasExpCat={hasExpCat}
        />
      </Suspense>
    </div>
  );
}
