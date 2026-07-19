import React from "react";
import { motion } from "framer-motion";
import { Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function AIGreeting({ jobCount, pipelineToday, overdueInvoices, openEstimates, monthRevenue, prevMonthRevenue, topPendingEst }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user?.full_name?.split(" ")[0] || "there";

  const revenueChange = prevMonthRevenue > 0
    ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
    : null;

  // Build the brief lines
  const lines = [
    {
      emoji: "📅",
      text: jobCount > 0
        ? `${jobCount} job${jobCount !== 1 ? "s" : ""} scheduled today${pipelineToday > 0 ? ` · $${pipelineToday.toLocaleString()} expected` : ""}`
        : "No jobs scheduled today",
      action: () => navigate("/jobs"),
    },
    overdueInvoices > 0 && {
      emoji: "🧾",
      text: `${overdueInvoices} invoice${overdueInvoices !== 1 ? "s" : ""} overdue`,
      action: () => navigate("/invoices"),
    },
    openEstimates > 0 && {
      emoji: "📋",
      text: `${openEstimates} estimate${openEstimates !== 1 ? "s" : ""} awaiting approval`,
      action: () => navigate("/estimates"),
    },
    revenueChange !== null && {
      emoji: revenueChange >= 0 ? "📈" : "📉",
      text: revenueChange >= 0
        ? `Revenue is up ${revenueChange}% from last month`
        : `Revenue is down ${Math.abs(revenueChange)}% from last month`,
      action: () => navigate("/reports"),
    },
  ].filter(Boolean);

  // AI recommendation
  let recommendation = null;
  if (topPendingEst) {
    const days = topPendingEst.valid_until
      ? Math.max(0, Math.round((new Date(topPendingEst.valid_until) - new Date()) / 86400000))
      : null;
    recommendation = `Follow up with ${topPendingEst.customer_name} — their estimate has been pending${days !== null ? ` for ${days} day${days !== 1 ? "s" : ""}` : ""}.`;
  } else if (overdueInvoices > 0) {
    recommendation = `Send payment reminders for your ${overdueInvoices} overdue invoice${overdueInvoices !== 1 ? "s" : ""} to recover outstanding revenue.`;
  } else if (jobCount === 0) {
    recommendation = "Quiet day — great time to send follow-up estimates or check in with recent customers.";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mb-5"
    >
      {/* Greeting line */}
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {greeting}, {name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's what's happening in your business today.</p>
      </div>

      {/* Titan AI Brief Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(0,199,217,0.10) 0%, rgba(124,91,250,0.10) 100%)",
          border: "1px solid rgba(0,199,217,0.18)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top left, rgba(0,199,217,0.06) 0%, transparent 60%)" }} />

        <div className="relative p-5">
          {/* Card header */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center flex-shrink-0 ai-pulse">
              <Sparkles className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-xs font-bold text-titan-cyan uppercase tracking-widest leading-none">Titan AI</p>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">Daily Brief</p>
            </div>
          </div>

          {/* Brief lines */}
          <div className="space-y-2 mb-4">
            {lines.map((line, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 + i * 0.07 }}
                onClick={line.action}
                className="w-full flex items-start gap-2.5 text-left group"
              >
                <span className="text-base leading-snug flex-shrink-0">{line.emoji}</span>
                <span className="text-sm text-foreground group-hover:text-foreground transition-colors leading-snug">{line.text}</span>
              </motion.button>
            ))}
          </div>

          {/* AI Recommendation */}
          {recommendation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl px-3.5 py-3 mb-4"
              style={{ background: "rgba(124,91,250,0.12)", border: "1px solid rgba(124,91,250,0.2)" }}
            >
              <p className="text-xs text-titan-indigo font-semibold uppercase tracking-wider mb-1">💡 Recommendation</p>
              <p className="text-sm text-foreground leading-snug">{recommendation}</p>
            </motion.div>
          )}

          {/* CTA */}
          <button
            onClick={() => navigate("/assistant")}
            className="flex items-center gap-1.5 text-xs font-semibold text-titan-cyan hover:text-foreground transition-colors group"
          >
            Open Titan AI Assistant
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}