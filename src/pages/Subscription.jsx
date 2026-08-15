import React from "react";
import { CreditCard, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { createFunctionsModule } from "@/api/functions";
import { openStripeCustomerPortal } from "@/lib/stripeSubscriptions";
import { PLANS, getPlanConfig } from "@/lib/plan";
import { toast } from "@/components/ui/use-toast";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function stateCopy(status) {
  switch (status?.accessState) {
    case "lifetime": return { label: "Lifetime access", detail: "Premium access is permanently enabled on your TitanOS account." };
    case "founding_trial": return { label: "Founding trial", detail: `Your founding access is active${status.trialEndsAt ? ` through ${formatDate(status.trialEndsAt)}` : ""}.` };
    case "founding": return { label: "Founding member", detail: "Your founding entitlement is active and protected by server-backed account state." };
    case "trial": return { label: "Trial active", detail: `Your trial is active${status.trialEndsAt ? ` through ${formatDate(status.trialEndsAt)}` : ""}.` };
    case "payment_issue": return { label: "Payment needs attention", detail: "Stripe reports a past-due or unpaid subscription. Open billing to resolve it." };
    case "paid": return { label: "Paid subscription active", detail: "Your membership is active and synchronized from the payment provider." };
    case "canceled": return { label: "Subscription canceled", detail: "The latest Stripe subscription is canceled. Your current account entitlements are shown below." };
    default: return { label: "Free plan", detail: "No active paid subscription is currently attached to this account." };
  }
}

export default function Subscription() {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [openingPortal, setOpeningPortal] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await createFunctionsModule().invoke("subscriptionStatus", {});
      setStatus(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader variant="detail" label="Loading subscription" />;
  if (error || !status) {
    return <ErrorState title="Couldn't load subscription" message="Your billing status could not be verified." onRetry={load} />;
  }

  const state = stateCopy(status);
  const plan = getPlanConfig({ plan_tier: status.planTier }) || PLANS.starter;
  const paymentIssue = status.accessState === "payment_issue";

  const manageBilling = async () => {
    setOpeningPortal(true);
    try {
      await openStripeCustomerPortal();
    } catch (err) {
      toast({ title: "Billing portal unavailable", description: err.message || "Try again later.", variant: "destructive" });
      setOpeningPortal(false);
    }
  };

  return (
    <div className="page-pad max-w-4xl mx-auto pb-28 md:pb-10">
      <PageHeader eyebrow="Account" title="Subscription" subtitle="Authoritative membership, trial, renewal, and billing status." />

      <section className={`titan-surface p-5 mb-4 border ${paymentIssue ? "border-amber-500/30" : "border-primary/20"}`}>
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${paymentIssue ? "bg-amber-500/10" : "bg-primary/10"}`}>
            {paymentIssue ? <TriangleAlert className="w-5 h-5 text-amber-400" /> : <ShieldCheck className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{state.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{state.detail}</p>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <section className="titan-surface p-5">
          <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-primary" /><h2 className="text-sm font-semibold">Current plan</h2></div>
          <p className="text-2xl font-bold text-foreground">{plan?.name || status.planTier}</p>
          <p className="text-xs text-muted-foreground mt-1">Plan key: {status.planTier}</p>
          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between gap-3"><span>Paid subscriber</span><strong className="text-foreground">{status.payingSubscriber ? "Yes" : "No"}</strong></div>
            <div className="flex justify-between gap-3"><span>Lifetime premium</span><strong className="text-foreground">{status.lifetimePremium ? "Yes" : "No"}</strong></div>
            <div className="flex justify-between gap-3"><span>Founding member</span><strong className="text-foreground">{status.foundingUser ? `Yes${status.foundingNumber ? ` · #${status.foundingNumber}` : ""}` : "No"}</strong></div>
            <div className="flex justify-between gap-3"><span>Trial ends</span><strong className="text-foreground">{formatDate(status.trialEndsAt)}</strong></div>
          </div>
        </section>

        <section className="titan-surface p-5">
          <div className="flex items-center gap-2 mb-4"><CreditCard className="w-4 h-4 text-primary" /><h2 className="text-sm font-semibold">Billing lifecycle</h2></div>
          {status.stripe ? (
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3"><span>Stripe status</span><strong className="text-foreground capitalize">{status.stripe.status}</strong></div>
              <div className="flex justify-between gap-3"><span>Current period ends</span><strong className="text-foreground">{formatDate(status.stripe.currentPeriodEnd)}</strong></div>
              <div className="flex justify-between gap-3"><span>Cancellation</span><strong className="text-foreground">{status.stripe.cancelAtPeriodEnd ? "Ends at period close" : "Not scheduled"}</strong></div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No Stripe subscription is attached to this account. Google Play or permanent entitlements may still apply.</p>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/pricing">Compare or change plans</Link></Button>
        {status.stripe?.manageable ? (
          <Button type="button" variant="outline" onClick={manageBilling} disabled={openingPortal}>
            {openingPortal ? "Opening billing…" : status.stripe.cancelAtPeriodEnd ? "Manage or reactivate" : "Manage or cancel"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={load}>Refresh status</Button>
      </div>

      <p className="mt-5 text-[11px] text-muted-foreground">
        TitanOS does not use localStorage as billing authority. This page is loaded from authenticated server-backed profile and subscription records.
      </p>
    </div>
  );
}
