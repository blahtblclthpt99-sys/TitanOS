import React, { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, Briefcase, Receipt, DollarSign, ArrowDownRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useEntityData } from "@/hooks/useEntityData";
import { lastNMonthKeys } from "@/lib/date-utils";
import { sumPaidRevenue, sumExpenses, sumOutstanding } from "@/lib/finance-metrics";

const ReportsCharts = lazy(() => import("@/components/charts/ReportsCharts"));

export default function Reports() {
  const { data: [jobs, customers, invoices, expenses], loading, error, reload } = useEntityData([
    { entity: "Job",      method: "list", args: ["-created_date", 200] },
    { entity: "Customer", method: "list", args: ["-created_date", 200] },
    { entity: "Invoice",  method: "list", args: ["-created_date", 200] },
    { entity: "Expense",  method: "list", args: ["-date", 200] },
  ]);

  if (loading) return <PageLoader variant="list" label="Loading reports" />;
  if (error) return <ErrorState title="Couldn't load reports" onRetry={reload} />;

  const paidInvoices   = invoices.filter(i => i.status === "paid");
  const outstanding    = sumOutstanding(invoices);
  const completedJobs  = jobs.filter(j => j.status === "completed").length;
  const completionRate = jobs.length ? Math.round((completedJobs / jobs.length) * 100) : 0;
  const revenue        = sumPaidRevenue(invoices);
  const totalExpenses  = sumExpenses(expenses);

  // Last 6 months revenue + expenses
  const monthMap = Object.fromEntries(
    lastNMonthKeys(6).map(({ key, label }) => [key, { month: label, revenue: 0, expenses: 0 }])
  );
  paidInvoices.forEach(inv => {
    const k = (inv.created_date || "").slice(0, 7);
    if (monthMap[k]) monthMap[k].revenue += inv.total || 0;
  });
  expenses.forEach(exp => {
    const k = (exp.date || "").slice(0, 7);
    if (monthMap[k]) monthMap[k].expenses += exp.amount || 0;
  });
  const monthlyData = Object.values(monthMap);

  // Revenue by service type (jobs)
  const serviceRevMap = {};
  jobs.forEach(j => {
    const key = j.service_type || "Other";
    serviceRevMap[key] = (serviceRevMap[key] || 0) + (j.amount || 0);
  });
  const serviceData = Object.entries(serviceRevMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Expenses by category
  const expCatMap = {};
  expenses.forEach(e => {
    const key = e.category || "other";
    expCatMap[key] = (expCatMap[key] || 0) + (e.amount || 0);
  });
  const expCatData = Object.entries(expCatMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const statCards = [
    { icon: Briefcase,  label: "Total Jobs",       value: jobs.length,                        color: "text-titan-cyan",   bg: "bg-titan-cyan/10" },
    { icon: Users,      label: "Customers",         value: customers.length,                   color: "text-titan-indigo", bg: "bg-titan-indigo/10" },
    { icon: DollarSign, label: "Revenue",           value: `$${revenue.toLocaleString()}`,     color: "text-emerald-400",  bg: "bg-emerald-400/10" },
    { icon: ArrowDownRight, label: "Expenses",      value: `$${totalExpenses.toLocaleString()}`, color: "text-red-400",    bg: "bg-red-400/10" },
    { icon: TrendingUp, label: "Completion Rate",   value: `${completionRate}%`,               color: "text-titan-cyan",   bg: "bg-titan-cyan/10" },
    { icon: Receipt,    label: "Outstanding",       value: `$${outstanding.toLocaleString()}`, color: "text-titan-amber",  bg: "bg-titan-amber/10" },
  ];

  const hasMonthly  = monthlyData.some(d => d.revenue > 0 || d.expenses > 0);
  const hasService  = serviceData.length > 0;
  const hasExpCat   = expCatData.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Reports" subtitle="Business analytics & insights" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {statCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="glass rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{card.value}</p>
            <p className="text-sm text-white/40 mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <Suspense fallback={<div className="h-96 rounded-2xl bg-white/5 animate-pulse mb-6" aria-busy="true" aria-label="Loading charts" />}>
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