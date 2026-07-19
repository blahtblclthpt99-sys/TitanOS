import React, { memo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, DollarSign, Clock, ChevronRight,
  CheckCircle, FileText, Zap, ArrowUpRight
} from "lucide-react";
import AIGreeting from "@/components/dashboard/AIGreeting";
import QuickActions from "@/components/dashboard/QuickActions";
import LiveActivityCard from "@/components/dashboard/LiveActivityCard";
import { DashboardSkeleton } from "@/components/shared/SkeletonLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useNavigate } from "react-router-dom";
import { relativeTime } from "@/lib/date-utils";
import { useDashboardData } from "@/hooks/useDashboardData";

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, color = "text-white/50", children, linkTo, linkLabel }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">{title}</h2>
        </div>
        {linkTo && (
          <button type="button" onClick={() => navigate(linkTo)} className="text-xs text-white/30 hover:text-titan-cyan flex items-center gap-1 transition-colors">
            {linkLabel || "See all"} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </motion.div>
  );
}

// ── Empty row ────────────────────────────────────────────────────────────────
function EmptyRow({ text }) {
  return <p className="text-sm text-white/25 py-2">{text}</p>;
}

// ── Attention item ───────────────────────────────────────────────────────────
const AttentionItem = memo(function AttentionItem({ icon: Icon, iconColor, label, sub, value, valueColor = "text-white", onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] -mx-2 px-2 rounded-xl transition-colors text-left">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{label}</p>
        {sub && <p className="text-xs text-white/35 truncate">{sub}</p>}
      </div>
      {value && <span className={`text-sm font-bold flex-shrink-0 ${valueColor}`}>{value}</span>}
      <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
    </button>
  );
});

// ── Job row ──────────────────────────────────────────────────────────────────
const JOB_STATUS_STYLE = {
  scheduled:   "bg-titan-cyan/15 text-titan-cyan",
  in_progress: "bg-titan-amber/15 text-titan-amber",
  completed:   "bg-emerald-400/15 text-emerald-400",
  cancelled:   "bg-red-400/15 text-red-400",
};

const JobRow = memo(function JobRow({ job, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] -mx-2 px-2 rounded-xl transition-colors text-left">
      <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: job.color || "#00C7D9" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{job.title}</p>
        <p className="text-xs text-white/35 truncate">{job.customer_name}{job.scheduled_time ? ` · ${job.scheduled_time}` : ""}</p>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${JOB_STATUS_STYLE[job.status] || JOB_STATUS_STYLE.scheduled}`}>
        {job.status?.replace("_", " ")}
      </span>
    </button>
  );
});

// ── Next-action item ─────────────────────────────────────────────────────────
const NextAction = memo(function NextAction({ icon: Icon, text, sub, cta, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-start gap-3 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] -mx-2 px-2 rounded-xl transition-colors text-left group">
      <div className="w-8 h-8 rounded-xl bg-titan-indigo/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-titan-indigo" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{text}</p>
        {sub && <p className="text-xs text-white/35">{sub}</p>}
      </div>
      <span className="text-xs font-semibold text-titan-cyan group-hover:text-white transition-colors flex-shrink-0 mt-0.5">{cta}</span>
    </button>
  );
});

export default function Dashboard({ isActive = true }) {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useDashboardData({ enabled: isActive });

  if (!isActive && !data) return null;
  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <ErrorState
        title="Couldn't load dashboard"
        message="We had trouble fetching your business data. Check your connection and try again."
        onRetry={reload}
      />
    );
  }
  if (!data) return null;

  const revenueChange = data.prevMonthRevenue > 0
    ? Math.round(((data.monthRevenue - data.prevMonthRevenue) / data.prevMonthRevenue) * 100)
    : null;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32">

      {/* ── Greeting + AI Brief ─────────────────────────────── */}
      <AIGreeting
        jobCount={data.todayJobs.length}
        pipelineToday={data.pipelineToday}
        overdueInvoices={data.overdueInv.length}
        openEstimates={data.pendingEst.length}
        monthRevenue={data.monthRevenue}
        prevMonthRevenue={data.prevMonthRevenue}
        topPendingEst={data.topPendingEst}
      />

      <QuickActions />

      <LiveActivityCard />

      {/* ── Revenue banner ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"
      >
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-white/40 mb-1">Active Jobs Today</p>
          <p className="text-2xl font-bold text-white">{data.todayJobs.length}</p>
          <p className="text-xs text-white/30 mt-1">${data.pipelineToday.toLocaleString()} expected</p>
        </div>
        <button onClick={() => navigate("/reports")} className="glass glass-hover rounded-2xl p-4 text-left transition-all">
          <p className="text-xs text-white/40 mb-1">Revenue This Month</p>
          <p className="text-2xl font-bold text-white">${data.monthRevenue.toLocaleString()}</p>
          {revenueChange !== null && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${revenueChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              <ArrowUpRight className={`w-3 h-3 ${revenueChange < 0 ? "rotate-180" : ""}`} />
              {revenueChange >= 0 ? "+" : ""}{revenueChange}% vs last month
            </p>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate("/estimates")}
          className="glass glass-hover rounded-2xl p-4 text-left transition-all"
        >
          <p className="text-xs text-white/40 mb-1">Pending Estimates</p>
          <p className="text-2xl font-bold text-white">{data.pendingEst.length}</p>
          <p className="text-xs text-white/30 mt-1">awaiting approval</p>
        </button>
        <button
          type="button"
          onClick={() => navigate("/invoices")}
          className="glass glass-hover rounded-2xl p-4 text-left transition-all"
        >
          <p className="text-xs text-white/40 mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-red-400">${data.outstandingTotal.toLocaleString()}</p>
          <p className="text-xs text-white/30 mt-1">{data.overdueInv.length + data.pendingInv.length} invoice{(data.overdueInv.length + data.pendingInv.length) !== 1 ? "s" : ""} unpaid</p>
        </button>
      </motion.div>

      <div className="space-y-4">

        {/* ── 1. What needs my attention? ─────────────────── */}
        <Section title="Needs Attention" icon={AlertTriangle} color="text-red-400" linkTo="/invoices" linkLabel="All invoices">
          {data.overdueInv.length === 0 && data.pendingInv.length === 0 && data.pendingEst.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-emerald-400">You're all caught up — nothing urgent.</p>
            </div>
          ) : (
            <>
              {data.overdueInv.slice(0, 3).map(inv => (
                <AttentionItem
                  key={inv.id}
                  icon={AlertTriangle}
                  iconColor="bg-red-400/15 text-red-400"
                  label={`Overdue — ${inv.customer_name}`}
                  sub={`Invoice ${inv.invoice_number || ""} · Due ${inv.due_date ? relativeTime(inv.due_date) : "unknown"}`}
                  value={`$${(inv.balance_due || inv.total || 0).toLocaleString()}`}
                  valueColor="text-red-400"
                  onClick={() => navigate("/invoices")}
                />
              ))}
              {data.pendingEst.slice(0, 2).map(est => (
                <AttentionItem
                  key={est.id}
                  icon={FileText}
                  iconColor="bg-titan-amber/15 text-titan-amber"
                  label={`Estimate waiting — ${est.customer_name}`}
                  sub={est.valid_until ? `Expires ${relativeTime(est.valid_until)}` : "Sent, no response"}
                  value={`$${(est.total || 0).toLocaleString()}`}
                  valueColor="text-titan-amber"
                  onClick={() => navigate("/estimates")}
                />
              ))}
            </>
          )}
        </Section>

        {/* ── 2. What's making me money today? ────────────── */}
        <Section title="Making Money Today" icon={DollarSign} color="text-emerald-400" linkTo="/jobs" linkLabel="All jobs">
          {data.todayJobs.length === 0 ? (
            <EmptyRow text="No jobs scheduled today — add one to get started." />
          ) : (
            data.todayJobs.slice(0, 5).map(job => (
              <JobRow key={job.id} job={job} onClick={() => navigate("/jobs")} />
            ))
          )}
          {data.todayJobs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-white/30">Expected today</span>
              <span className="text-sm font-bold text-emerald-400">${data.pipelineToday.toLocaleString()}</span>
            </div>
          )}
        </Section>

        {/* ── 3. What's overdue? ───────────────────────────── */}
        <Section title="Overdue & Outstanding" icon={Clock} color="text-titan-amber" linkTo="/invoices" linkLabel="Manage">
          {data.overdueInv.length === 0 && data.pendingInv.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-emerald-400">No outstanding invoices. </p>
            </div>
          ) : (
            <>
              {[...data.overdueInv, ...data.pendingInv].slice(0, 5).map(inv => (
                <AttentionItem
                  key={inv.id}
                  icon={DollarSign}
                  iconColor={inv.status === "overdue" ? "bg-red-400/15 text-red-400" : "bg-titan-amber/15 text-titan-amber"}
                  label={inv.customer_name}
                  sub={`${inv.status === "overdue" ? "OVERDUE" : "Sent"} · Invoice ${inv.invoice_number || ""}`}
                  value={`$${(inv.balance_due || inv.total || 0).toLocaleString()}`}
                  valueColor={inv.status === "overdue" ? "text-red-400" : "text-titan-amber"}
                  onClick={() => navigate("/invoices")}
                />
              ))}
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-white/30">Total outstanding</span>
                <span className="text-sm font-bold text-red-400">${data.overdueTotal.toLocaleString()}</span>
              </div>
            </>
          )}
        </Section>

        {/* ── 4. What should I do next? ────────────────────── */}
        <Section title="Do Next" icon={Zap} color="text-titan-indigo">
          {data.nextActions.map((action, i) => (
            <NextAction
              key={i}
              icon={action.icon}
              text={action.text}
              sub={action.sub}
              cta={action.cta}
              onClick={() => navigate(action.path)}
            />
          ))}
        </Section>

      </div>

    </div>
  );
}