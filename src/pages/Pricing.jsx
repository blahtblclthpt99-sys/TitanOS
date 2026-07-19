import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Download,
  Rocket,
  Smartphone,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { openPlayStore } from "@/lib/app-download";
import { PLANS, betaBadgeLabel } from "@/lib/plan";
import { formatMoney } from "@/lib/platformFee";

const FREE_FEATURES = [
  `Transaction fee ${PLANS.free.feeLabel}`,
  "Basic CRM (customers, jobs, schedule)",
  "Estimates & invoices (limited)",
  `Up to ${PLANS.free.maxActiveListings} active marketplace listings`,
  `Up to ${PLANS.free.maxActiveHirePosts} open hire posts`,
  "Expense & tax basics",
];

const PREMIUM_FEATURES = [
  `Lower transaction fee ${PLANS.premium.feeLabel}`,
  "Unlimited estimates & invoices",
  "Unlimited marketplace listings & hire posts",
  "Featured profile placement",
  "Priority in search results",
  "Advanced analytics & reports",
  "AI business assistant",
  "Custom booking page",
  "Expanded photo & document storage",
];

const PRO_FEATURES_LIST = [
  `Lowest transaction fee ${PLANS.pro.feeLabel}`,
  "Everything in Premium",
  "Highest search priority",
  "Priority storage & support",
  "Best for growing multi-crew teams",
];

function PlanCard({ plan, features, highlighted, cta, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`w-full glass rounded-3xl p-6 sm:p-8 border ${
        highlighted ? "border-titan-cyan/40 titan-glow" : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {highlighted ? <Sparkles className="w-4 h-4 text-titan-cyan" /> : <Star className="w-4 h-4 text-white/40" />}
            <h2 className="text-xl font-bold text-white">{plan.name}</h2>
          </div>
          <p className="text-xs text-white/40">{plan.feeLabel} on in-app transactions</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-titan-cyan">
            {plan.priceMonthly === 0 ? "$0" : formatMoney(plan.priceMonthly)}
          </span>
          <p className="text-xs text-white/40 mt-0.5">{plan.priceMonthly === 0 ? "forever" : "per month"}</p>
        </div>
      </div>

      <div className="space-y-2.5 mb-6">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-titan-cyan/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-titan-cyan" />
            </div>
            <span className="text-xs text-white/60 leading-relaxed">{f}</span>
          </div>
        ))}
      </div>

      <Button
        asChild
        className={`w-full rounded-2xl h-12 text-sm font-semibold gap-2 ${
          highlighted
            ? "bg-titan-cyan hover:bg-titan-cyan/90 text-black"
            : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
        }`}
      >
        <Link to={cta.to}>
          {cta.label} <ArrowRight className="w-4 h-4" />
        </Link>
      </Button>
    </motion.div>
  );
}

export default function Pricing() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center py-12 px-4 pb-24">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 max-w-2xl w-full">
        {betaBadgeLabel() && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-titan-cyan/10 border border-titan-cyan/20 mb-6">
            <Rocket className="w-3.5 h-3.5 text-titan-cyan" />
            <span className="text-xs text-titan-cyan font-semibold uppercase tracking-wider">{betaBadgeLabel()}</span>
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          Simple plans for<br />
          <span className="gradient-text">field pros</span>
        </h1>
        <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto">
          Start free with a {PLANS.free.feeLabel} transaction fee. Upgrade to Premium or Pro to cut fees and unlock growth tools.
        </p>
      </motion.div>

      <div className="w-full max-w-5xl grid md:grid-cols-3 gap-5 mb-8">
        <PlanCard
          plan={PLANS.free}
          features={FREE_FEATURES}
          highlighted={false}
          cta={{ to: "/register", label: "Start Free" }}
          delay={0.05}
        />
        <PlanCard
          plan={PLANS.premium}
          features={PREMIUM_FEATURES}
          highlighted
          cta={{ to: "/register", label: "Get Premium" }}
          delay={0.1}
        />
        <PlanCard
          plan={PLANS.pro}
          features={PRO_FEATURES_LIST}
          highlighted={false}
          cta={{ to: "/register", label: "Get Pro" }}
          delay={0.15}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-5xl glass rounded-2xl p-5 border border-titan-indigo/20 mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-titan-indigo/30 to-titan-cyan/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-titan-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white mb-0.5">TitanOS for Android</p>
            <p className="text-xs text-white/40">Same plans on mobile — install from Google Play</p>
          </div>
          <Button
            onClick={openPlayStore}
            className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-10 px-4 gap-1.5 flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            Get App
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-5xl glass rounded-2xl p-5 border border-white/5"
      >
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-titan-amber flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white mb-1">How fees work</p>
            <p className="text-xs text-white/50 leading-relaxed">
              When you collect payment through TitanOS, your plan fee is added on checkout
              (Free {PLANS.free.feeLabel}, Premium {PLANS.premium.feeLabel}, Pro {PLANS.pro.feeLabel}).
              Refer 3 paying subscribers for lifetime Premium.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
