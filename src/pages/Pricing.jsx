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
  Star,
  UserRound,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { openPlayStore } from "@/lib/app-download";
import {
  PLANS,
  betaBadgeLabel,
  getPlanCheckoutUrl,
  isFreeDuringBeta,
  BETA_PERK_LABEL,
} from "@/lib/plan";
import { getLaunchStatus } from "@/lib/launchStatus";
import { formatMoney } from "@/lib/platformFee";
import SiteFooter from "@/components/marketing/SiteFooter";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  PLAY_SUBSCRIPTIONS,
  isAndroidPlayBuild,
  loadPlaySubscriptions,
  onPlayPurchaseUpdated,
  startPlaySubscription,
  verifyPlayPurchase,
} from "@/lib/playBilling";
import { startStripeSubscription } from "@/lib/stripeSubscriptions";

function buildCards() {
  const foundingOpen = isFreeDuringBeta();
  const spots = getLaunchStatus().spotsRemaining;
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
      plan: PLANS.starter,
      icon: Briefcase,
      features: [
        `${PLANS.starter.feeLabel} fee on payments you collect`,
        foundingOpen ? `Founding: first month free, then $${PLANS.starter.priceMonthly}/mo locked` : `$${PLANS.starter.priceMonthly}/mo`,
        "Dashboard, schedule, mileage & expense tracking",
        "Driver Hub Lite + messaging",
        "Marketplace browsing",
      ],
      cta: {
        href: getPlanCheckoutUrl("starter"),
        to: "/register",
        label: foundingOpen ? `Claim Founding Starter — ${BETA_PERK_LABEL}` : `Get Starter — $${PLANS.starter.priceMonthly}`,
      },
      highlighted: false,
    },
    {
      plan: PLANS.worker_premium,
      icon: Sparkles,
      badge: "Most Popular",
      features: [
        `${PLANS.worker_premium.feeLabel} transaction fee`,
        foundingOpen
          ? `Founding: first month free, then $${PLANS.worker_premium.priceMonthly}/mo locked`
          : `$${PLANS.worker_premium.priceMonthly}/mo membership`,
        "Full Driver Hub + Driver AI",
        "Titan Business Assistant + Titan Radio",
        "Tax Center, Marketplace Apps, analytics",
      ],
      cta: {
        href: getPlanCheckoutUrl("worker_premium"),
        to: "/register",
        label: foundingOpen
          ? `Claim Founding Pro — ${spots} spots left`
          : `Go Pro — $${PLANS.worker_premium.priceMonthly}`,
      },
      highlighted: true,
    },
    {
      plan: PLANS.business,
      icon: Building2,
      features: [
        `${PLANS.business.feeLabel} transaction fee (lowest)`,
        foundingOpen
          ? `Founding: first month free, then $${PLANS.business.priceMonthly}/mo locked`
          : `$${PLANS.business.priceMonthly}/mo`,
        "Everything in Pro",
        "Teams, fleet, employee profiles",
        "Admin controls + highest storage",
      ],
      cta: {
        href: getPlanCheckoutUrl("business"),
        to: "/register",
        label: foundingOpen
          ? `Claim Founding Business — ${BETA_PERK_LABEL}`
          : `Get Business — $${PLANS.business.priceMonthly}`,
      },
      highlighted: false,
    },
  ];
}

function PlanCard({ plan, icon: Icon, features, highlighted, cta, delay, badge, androidPlay, playProduct, onPlayPurchase, onStripePurchase, purchasing }) {
  const checkoutHref = androidPlay ? null : (cta.href || plan.checkoutUrl || null);
  const isPaidPlayPlan = androidPlay && Boolean(PLAY_SUBSCRIPTIONS[plan.id]);
  const isPaidStripePlan = !androidPlay && plan.priceMonthly > 0;
  const playPrice = playProduct?.offers?.[0]?.pricingPhases?.slice(-1)[0]?.formattedPrice;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`relative w-full titan-surface p-6 border ${
        highlighted ? "border-titan-cyan/40 titan-glow" : "border-border"
      }`}
    >
      {(badge || plan.mostPopular) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-titan-cyan px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
          <Star className="w-3 h-3" /> {badge || "Most Popular"}
        </div>
      )}
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
            {plan.priceMonthly === 0 ? "$0" : (playPrice || formatMoney(plan.priceMonthly))}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {plan.priceMonthly === 0 ? "to hire" : "/ month"}
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
        asChild={!isPaidPlayPlan && !isPaidStripePlan}
        onClick={isPaidPlayPlan ? () => onPlayPurchase(plan.id) : isPaidStripePlan ? () => onStripePurchase(plan.id) : undefined}
        disabled={(isPaidPlayPlan || isPaidStripePlan) && purchasing}
        className={`w-full rounded-2xl h-11 text-sm font-semibold gap-2 ${
          highlighted
            ? "bg-titan-cyan hover:bg-titan-cyan/90 text-black"
            : "bg-muted hover:bg-muted/80 text-foreground border border-border"
        }`}
      >
        {isPaidPlayPlan || isPaidStripePlan ? (
          <span>{purchasing ? "Opening secure checkout…" : `Choose ${plan.name}`} <ArrowRight className="w-4 h-4" /></span>
        ) : checkoutHref ? (
          <a href={checkoutHref} target="_blank" rel="noopener noreferrer">
            {cta.label} <ArrowRight className="w-4 h-4" />
          </a>
        ) : (
          <Link to={cta.to || "/register"}>
            {cta.label} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </Button>
      {isPaidPlayPlan ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Secure subscription via Google Play · Cancel anytime</p>
      ) : isPaidStripePlan || checkoutHref ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Secure subscription via Stripe · Cancel anytime</p>
      ) : null}
    </motion.div>
  );
}

export default function Pricing() {
  const { user, checkUserAuth } = useAuth();
  const androidPlay = isAndroidPlayBuild();
  const [playProducts, setPlayProducts] = React.useState([]);
  const [purchasing, setPurchasing] = React.useState(false);
  const foundingOpen = isFreeDuringBeta();
  const cards = buildCards();
  const spots = getLaunchStatus().spotsRemaining;

  React.useEffect(() => {
    if (!androidPlay) return undefined;
    loadPlaySubscriptions().then(setPlayProducts).catch(() => {
      toast({ variant: "destructive", title: "Plans are temporarily unavailable", description: "Check your connection and try again." });
    });
    let handle;
    onPlayPurchaseUpdated(async ({ responseCode, purchases = [] }) => {
      if (responseCode !== 0) {
        setPurchasing(false);
        if (responseCode !== 1) toast({ variant: "destructive", title: "Purchase not completed", description: "Google Play did not complete the subscription." });
        return;
      }
      const purchased = purchases.filter((purchase) => purchase.purchaseState === 1);
      if (!purchased.length) {
        setPurchasing(false);
        toast({ title: "Purchase pending", description: "Your plan will unlock after Google Play confirms payment." });
        return;
      }
      try {
        for (const purchase of purchased) await verifyPlayPurchase(purchase);
        await checkUserAuth();
        toast({ title: "Subscription active", description: "Your TitanOS plan is ready." });
      } catch (error) {
        toast({ variant: "destructive", title: "Purchase needs verification", description: error.message || "Try Restore purchases shortly." });
      } finally {
        setPurchasing(false);
      }
    }).then((listener) => { handle = listener; });
    return () => { handle?.remove(); };
  }, [androidPlay, checkUserAuth]);

  const buyWithPlay = React.useCallback(async (planId) => {
    if (!user?.id) {
      toast({ title: "Sign in first", description: "Your Play subscription must be linked to your TitanOS account." });
      window.location.assign("/login?next=/pricing");
      return;
    }
    try {
      setPurchasing(true);
      await startPlaySubscription(planId, user.id);
    } catch (error) {
      setPurchasing(false);
      toast({ variant: "destructive", title: "Could not open Google Play", description: error.message || "Try again." });
    }
  }, [user?.id]);

  const buyWithStripe = React.useCallback(async (planId) => {
    if (!user?.id) {
      toast({ title: "Sign in first", description: "Your subscription must be linked to your TitanOS account." });
      window.location.assign("/login?next=/pricing");
      return;
    }
    try {
      setPurchasing(true);
      await startStripeSubscription(planId);
    } catch (error) {
      setPurchasing(false);
      toast({ variant: "destructive", title: "Checkout unavailable", description: error.message || "Try again later." });
    }
  }, [user?.id]);
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
          {foundingOpen ? (
            <>
              Try free for 3 days<br />
              <span className="gradient-text">then $4.99/month</span>
            </>
          ) : (
            <>
              Try free for 3 days<br />
              <span className="gradient-text">then $4.99/month</span>
            </>
          )}
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
          {foundingOpen
            ? `Start with a 3-day free trial, then continue at $${PLANS.starter.priceMonthly}/month for the core plan. Fees still apply when you collect payment.`
            : `Start with a 3-day free trial, then continue at $${PLANS.starter.priceMonthly}/month for the core plan. Pro and Business are available for more tools and larger operations.`}
        </p>
      </motion.div>

      <div className="w-full max-w-6xl grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {cards.map((card, index) => (
          <PlanCard
            key={card.plan.id}
            {...card}
            delay={0.05 + index * 0.05}
            androidPlay={androidPlay}
            playProduct={playProducts.find((product) => product.productId === PLAY_SUBSCRIPTIONS[card.plan.id])}
            onPlayPurchase={buyWithPlay}
            onStripePurchase={buyWithStripe}
            purchasing={purchasing}
          />
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
              Same plans on mobile via Google Play
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
              Start with a 3-day free trial, then continue at $4.99/month for the core plan. Premium tiers unlock more automation and team tools.
              Fees apply when you collect payment — Customer {PLANS.customer.feeLabel}, Starter {PLANS.starter.feeLabel},
              Pro {PLANS.worker_premium.feeLabel}, Business {PLANS.business.feeLabel}.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
    <SiteFooter />
    </div>
  );
}
