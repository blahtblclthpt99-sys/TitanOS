import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Download,
  Rocket,
  Smartphone,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { openPlayStore } from "@/lib/app-download";
import { PLANS, betaBadgeLabel, getPlanCheckoutUrl, isFreeDuringBeta, BETA_PERK_LABEL } from "@/lib/plan";
import { formatMoney } from "@/lib/platformFee";
import SiteFooter from "@/components/marketing/SiteFooter";

function buildCards() {
  const freeBeta = isFreeDuringBeta();
  return [
  {
    plan: PLANS.customer,
    icon: UserRound,
    features: [
      "Free to join",
      "Hire local professionals",
      "No monthly subscription",
      "No platform fee to hire",
      "Message & book workers",
    ],
    cta: { to: "/register", label: "Join free" },
    highlighted: false,
  },
  {
    plan: PLANS.worker_free,
    icon: Briefcase,
    features: [
      `${PLANS.worker_free.feeLabel} fee on payments you collect`,
      "No monthly cost to start",
      "Free unlimited marketplace listings",
      "Basic CRM, estimates & invoices",
      "Upgrade anytime as you book more work",
    ],
    cta: { to: "/register", label: "Start as a worker" },
    highlighted: false,
  },
  {
    plan: PLANS.worker_premium,
    icon: Sparkles,
    features: [
      `${PLANS.worker_premium.feeLabel} transaction fee`,
      freeBeta ? "Free during Founding 100 (fees still apply)" : "$29.99/mo membership",
      "Unlimited listings & hire visibility",
      "Featured profile + search priority",
      "AI assistant, booking page, analytics",
      "Expanded photo & document storage",
    ],
    cta: {
      href: getPlanCheckoutUrl("worker_premium"),
      to: "/register",
      label: freeBeta ? `Unlock Premium — ${BETA_PERK_LABEL}` : "Go Premium — $29.99",
    },
    highlighted: true,
  },
  {
    plan: PLANS.business,
    icon: Building2,
    features: [
      `${PLANS.business.feeLabel} transaction fee (lowest)`,
      "Built for crews & multi-company ops",
      "Everything in Worker Premium",
      "Priority placement & storage",
      "Best value as volume grows",
    ],
    cta: {
      href: getPlanCheckoutUrl("business"),
      to: "/register",
      label: freeBeta ? `Unlock Business — ${BETA_PERK_LABEL}` : "Get Business — $49.99",
    },
    highlighted: false,
  },
];
}

function PlanCard({ plan, icon: Icon, features, highlighted, cta, delay }) {
  const checkoutHref = cta.href || plan.checkoutUrl || null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`w-full titan-surface p-6 border ${
        highlighted ? "border-titan-cyan/40 titan-glow" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{plan.audience}</p>
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${highlighted ? "text-titan-cyan" : "text-muted-foreground"}`} />
            <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{plan.blurb}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-bold text-titan-cyan">
            {plan.priceMonthly === 0 ? "$0" : formatMoney(plan.priceMonthly)}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {plan.priceMonthly === 0
              ? isFreeDuringBeta()
                ? BETA_PERK_LABEL
                : "to start"
              : "/ month"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">{plan.feeLabel} fee</p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-titan-cyan/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-titan-cyan" />
            </div>
            <span className="text-xs text-muted-foreground leading-relaxed">{f}</span>
          </div>
        ))}
      </div>

      <Button
        asChild
        className={`w-full rounded-2xl h-11 text-sm font-semibold gap-2 ${
          highlighted
            ? "bg-titan-cyan hover:bg-titan-cyan/90 text-black"
            : "bg-muted hover:bg-muted/80 text-foreground border border-border"
        }`}
      >
        {checkoutHref ? (
          <a href={checkoutHref} target="_blank" rel="noopener noreferrer">
            {cta.label} <ArrowRight className="w-4 h-4" />
          </a>
        ) : (
          <Link to={cta.to || "/register"}>
            {cta.label} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </Button>
      {checkoutHref ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Secure checkout via PayPal</p>
      ) : null}
    </motion.div>
  );
}

export default function Pricing() {
  const freeBeta = isFreeDuringBeta();
  const cards = buildCards();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
    <div className="flex-1 flex flex-col items-center py-12 px-4 pb-16">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 max-w-2xl w-full">
        {betaBadgeLabel() && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-titan-cyan/10 border border-titan-cyan/20 mb-6">
            <Rocket className="w-3.5 h-3.5 text-titan-cyan" />
            <span className="text-xs text-titan-cyan font-semibold uppercase tracking-wider">{betaBadgeLabel()}</span>
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
          {freeBeta ? (
            <>
              Founding 100 — free app<br />
              <span className="gradient-text">fees still apply</span>
            </>
          ) : (
            <>
              Launch pricing that<br />
              <span className="gradient-text">grows with you</span>
            </>
          )}
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
          {freeBeta
            ? "First 100 members get Premium tools free forever. Transaction fees still apply when you collect payment. After 100, membership checkout goes live."
            : `Customers hire free. Workers start at $0 with an ${PLANS.worker_free.feeLabel} fee, then upgrade as they book more work.`}
        </p>
      </motion.div>

      <div className="w-full max-w-6xl grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {cards.map((card, index) => (
          <PlanCard key={card.plan.id} {...card} delay={0.05 + index * 0.05} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-6xl titan-surface p-5 border border-titan-indigo/20 mb-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-titan-indigo/30 to-titan-cyan/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-titan-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground mb-0.5">TitanOS for Android</p>
            <p className="text-xs text-muted-foreground">
              {freeBeta ? "Same Founding 100 access on mobile via Google Play" : "Same launch pricing on mobile via Google Play"}
            </p>
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
        transition={{ delay: 0.35 }}
        className="w-full max-w-6xl titan-surface p-5 border border-border"
      >
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-titan-amber flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Why this structure</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              New users can try the platform with no upfront cost. Professionals get a clear incentive to upgrade as they book more work.
              Fees apply when you collect payment through TitanOS — Customer {PLANS.customer.feeLabel}, Worker Free {PLANS.worker_free.feeLabel},
              Worker Premium {PLANS.worker_premium.feeLabel}, Business {PLANS.business.feeLabel}. Pricing can adjust as the network grows.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
    <SiteFooter />
    </div>
  );
}
