import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  Download,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { openPlayStore } from "@/lib/app-download";
import { PLANS } from "@/lib/plan";
import { formatMoney } from "@/lib/platformFee";
import SiteFooter from "@/components/marketing/SiteFooter";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  PLAY_SUBSCRIPTIONS,
  isAndroidPlayBuild,
  loadPlaySubscriptions,
  onPlayPurchaseUpdated,
  restorePlaySubscriptions,
  startPlaySubscription,
  verifyPlayPurchase,
} from "@/lib/playBilling";
import { startStripeSubscription } from "@/lib/stripeSubscriptions";

const CARD_DEFINITIONS = [
  {
    planId: "worker_free",
    displayName: "Career Free",
    audience: "Job seekers & workers",
    description: "The career core stays useful without a paid subscription.",
    icon: UserRoundSearch,
    features: [
      "Career profile and work preferences",
      "Job and opportunity discovery",
      "Transparent opportunity matching",
      "Saved jobs and application tracking",
      "Career schedule and notifications",
    ],
  },
  {
    planId: "starter",
    displayName: "Starter",
    audience: "People managing their own work",
    description: "Add practical work-management tools after you find the work.",
    icon: BriefcaseBusiness,
    features: [
      "Everything in Career Free",
      "Unlimited estimates and invoices",
      "Booking and digital contracts",
      "Work records and customer tools",
      "User-initiated location check-in tools",
    ],
  },
  {
    planId: "worker_premium",
    displayName: "Pro",
    audience: "Career builders & independent pros",
    description: "Add AI assistance and advanced work intelligence.",
    icon: Sparkles,
    highlighted: true,
    features: [
      "Everything in Starter",
      "TitanAI career and work assistance",
      "Advanced analytics and reports",
      "Route optimization and receipt tools",
      "Expanded professional tools",
    ],
  },
  {
    planId: "business",
    displayName: "Business",
    audience: "Teams, employers & operations",
    description: "Coordinate opportunities, people, and larger operations.",
    icon: Building2,
    features: [
      "Everything in Pro",
      "Team and company workflows",
      "Fleet and shared operations tools",
      "Multi-company and administrative controls",
      "Priority business organization tools",
    ],
  },
];

function PlanCard({ definition, androidPlay, playProduct, onPlayPurchase, onStripePurchase, purchasing }) {
  const plan = PLANS[definition.planId];
  const Icon = definition.icon;
  const paid = Number(plan?.priceMonthly || 0) > 0;
  const playEnabled = androidPlay && paid && Boolean(PLAY_SUBSCRIPTIONS[definition.planId]);
  const playPrice = playProduct?.offers?.[0]?.pricingPhases?.slice(-1)[0]?.formattedPrice;
  const displayedPrice = paid ? (playPrice || formatMoney(plan.priceMonthly)) : "$0";

  const handlePaid = () => {
    if (playEnabled) return onPlayPurchase(definition.planId);
    return onStripePurchase(definition.planId);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-soft ${definition.highlighted ? "border-primary/50 shadow-lift" : "border-border"}`}
    >
      {definition.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          Most capable for individuals
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{definition.audience}</p>
          <div className="mt-2 flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-xl font-bold">{definition.displayName}</h2>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-primary">{displayedPrice}</p>
          <p className="text-xs text-muted-foreground">{paid ? "/ month" : "career core"}</p>
        </div>
      </div>

      <p className="mt-4 min-h-12 text-sm leading-6 text-muted-foreground">{definition.description}</p>

      <div className="mt-5 flex-1 space-y-2.5">
        {definition.features.map((feature) => (
          <div key={feature} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/10">
              <Check className="h-3 w-3 text-primary" aria-hidden="true" />
            </span>
            <span className="text-sm leading-5 text-muted-foreground">{feature}</span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        {paid ? (
          <Button type="button" onClick={handlePaid} disabled={purchasing} className="h-11 w-full gap-2 rounded-xl">
            {purchasing ? "Opening secure checkout…" : `Choose ${definition.displayName}`}
            {!purchasing && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        ) : (
          <Button asChild className="h-11 w-full gap-2 rounded-xl">
            <Link to="/register">Start free <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </Button>
        )}
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {paid ? (androidPlay ? "Android subscription via Google Play" : "Web subscription via Stripe") : "No paid subscription required"}
        </p>
      </div>
    </motion.article>
  );
}

export default function Pricing() {
  const { user, checkUserAuth } = useAuth();
  const androidPlay = isAndroidPlayBuild();
  const [playProducts, setPlayProducts] = React.useState([]);
  const [purchasing, setPurchasing] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  React.useEffect(() => {
    if (!androidPlay) return undefined;
    let active = true;
    let handle;

    loadPlaySubscriptions()
      .then((products) => { if (active) setPlayProducts(products); })
      .catch(() => {
        if (active) toast({ variant: "destructive", title: "Plans are temporarily unavailable", description: "Check your connection and try again." });
      });

    onPlayPurchaseUpdated(async ({ responseCode, purchases = [] }) => {
      if (!active) return;
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
        toast({ title: "Subscription active", description: "Google Play verified your TitanOS plan." });
      } catch (error) {
        toast({ variant: "destructive", title: "Purchase needs verification", description: error.message || "Use Restore purchases after Google Play confirms the purchase." });
      } finally {
        if (active) setPurchasing(false);
      }
    }).then((listener) => {
      if (active) handle = listener;
      else listener?.remove?.();
    });

    return () => {
      active = false;
      handle?.remove?.();
    };
  }, [androidPlay, checkUserAuth]);

  const requireSignedIn = React.useCallback(() => {
    if (user?.id) return true;
    toast({ title: "Sign in first", description: "Your subscription must be linked to your TitanOS account." });
    window.location.assign("/login?next=/pricing");
    return false;
  }, [user?.id]);

  const buyWithPlay = React.useCallback(async (planId) => {
    if (!requireSignedIn()) return;
    try {
      setPurchasing(true);
      await startPlaySubscription(planId, user.id);
    } catch (error) {
      setPurchasing(false);
      toast({ variant: "destructive", title: "Could not open Google Play", description: error.message || "Try again." });
    }
  }, [requireSignedIn, user?.id]);

  const buyWithStripe = React.useCallback(async (planId) => {
    if (!requireSignedIn()) return;
    try {
      setPurchasing(true);
      await startStripeSubscription(planId);
    } catch (error) {
      setPurchasing(false);
      toast({ variant: "destructive", title: "Checkout unavailable", description: error.message || "Try again later." });
    }
  }, [requireSignedIn]);

  const restorePurchases = React.useCallback(async () => {
    if (!requireSignedIn()) return;
    try {
      setRestoring(true);
      const purchases = await restorePlaySubscriptions();
      const purchased = purchases.filter((purchase) => purchase.purchaseState === 1);
      if (!purchased.length) {
        toast({ title: "No active purchase found", description: "Google Play did not return an active TitanOS subscription for this account." });
        return;
      }
      for (const purchase of purchased) await verifyPlayPurchase(purchase);
      await checkUserAuth();
      toast({ title: "Purchases restored", description: "Your verified TitanOS subscription is active." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not restore purchases", description: error.message || "Try again later." });
    } finally {
      setRestoring(false);
    }
  }, [checkUserAuth, requireSignedIn]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Clear plans. Verified checkout.
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">Start with the career core for free.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Search opportunities, build your career profile, understand matches, and track applications without a paid subscription. Upgrade when you need deeper AI, business, or work-management capability.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {CARD_DEFINITIONS.map((definition) => (
              <PlanCard
                key={definition.planId}
                definition={definition}
                androidPlay={androidPlay}
                playProduct={playProducts.find((product) => product.productId === PLAY_SUBSCRIPTIONS[definition.planId])}
                onPlayPurchase={buyWithPlay}
                onStripePurchase={buyWithStripe}
                purchasing={purchasing}
              />
            ))}
          </div>

          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-5 w-5 flex-none text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold">Android billing</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Paid digital plans purchased in the Android app use Google Play Billing. TitanOS verifies completed purchases with its server before granting the paid entitlement.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={openPlayStore} className="gap-2">
                      <Download className="h-4 w-4" aria-hidden="true" /> Get Android app
                    </Button>
                    {androidPlay && (
                      <Button type="button" variant="outline" disabled={restoring} onClick={restorePurchases} className="gap-2">
                        <RefreshCcw className="h-4 w-4" aria-hidden="true" /> {restoring ? "Restoring…" : "Restore purchases"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 flex-none text-primary" aria-hidden="true" />
                <div>
                  <h2 className="font-bold">Hiring and business use</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Employers and customers can use TitanOS opportunity and hiring workflows without changing the job seeker's career-core experience. Business plans add larger operational tools when needed.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-muted-foreground">
            Prices and renewal terms shown at checkout are authoritative. Paid plans do not guarantee employment, income, profit, job availability, or hiring outcomes. Transaction fees may apply when you collect payments through supported work tools.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
