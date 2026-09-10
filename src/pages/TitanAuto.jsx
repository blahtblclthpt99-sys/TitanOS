import React, { useMemo, useState } from "react";
import { Bot, BriefcaseBusiness, CheckCircle2, ExternalLink, Mail, ShieldCheck, Workflow } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { toast } from "@/components/ui/use-toast";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { getPlanCheckoutUrl, resolvePlan } from "@/lib/plan";

const today = () => new Date().toISOString().slice(0, 10);

const AUTOMATION_LANES = [
  {
    title: "Job Seeker",
    description: "Use TitanAI and Second Me to prepare job-search work while you stay in control of submissions and account actions.",
    path: "/jobs",
    action: "Open Jobs",
  },
  {
    title: "Independent Work",
    description: "Coordinate schedules, follow-ups, routes, invoices, and repeatable field-work tasks from one TitanOS workflow.",
    path: "/schedule",
    action: "Open Schedule",
  },
  {
    title: "Business",
    description: "Run approved customer and invoice workflows with account-level safeguards and auditable completion.",
    path: "/companies",
    action: "Open Business",
  },
];

export default function TitanAuto() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const returnedOrder = searchParams.get("order");
  const checkout = searchParams.get("checkout");
  const [selected, setSelected] = useState([]);
  const [working, setWorking] = useState(false);
  const paidMembership = user?.paying_subscriber === true && ["worker_premium", "business"].includes(resolvePlan(user));
  const showOneTime = import.meta.env.VITE_AUTOPILOT_ONETIME_CHECKOUT === "true";
  const { data: invoices = [], loading, error, reload } = useSafeAsync(
    () => api.entities.Invoice.list("due_date", 200),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );
  const eligible = useMemo(() => invoices.filter((invoice) =>
    invoice.status !== "paid" && invoice.customer_email && invoice.due_date && invoice.due_date < today() && Number(invoice.balance_due ?? invoice.total) > 0
  ), [invoices]);

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 10 ? [...current, id] : current);
  const checkoutNow = async () => {
    setWorking(true);
    try {
      // Keep the proven backend contract while Titan Auto becomes the canonical UI surface.
      const result = await api.functions.invoke("createAutopilotOrder", { invoice_ids: selected });
      if (!result.checkout_url) throw new Error("Checkout URL missing");
      window.location.assign(result.checkout_url);
    } catch (err) {
      toast({ title: "Checkout couldn't start", description: err?.message, variant: "destructive" });
      setWorking(false);
    }
  };
  const runOrder = async () => {
    setWorking(true);
    try {
      const result = await api.functions.invoke("runAutopilotOrder", { order_id: returnedOrder });
      toast({ title: result.duplicate ? "Sprint already completed" : "Recovery sprint completed", description: `${result.sent || 0} sent · ${result.failed || 0} failed` });
    } catch (err) {
      toast({ title: "Sprint isn't ready", description: err?.message, variant: "destructive" });
    } finally { setWorking(false); }
  };
  const runMembership = async () => {
    setWorking(true);
    try {
      const result = await api.functions.invoke("runAutopilotMembership", { invoice_ids: selected });
      const queued = result.delivery_mode === "review_queue";
      toast({ title: queued ? "Reminders prepared for review" : "Included recovery sprint completed", description: queued ? `${result.prepared || 0} ready in Follow-ups` : `${result.sent || 0} sent · ${result.failed || 0} failed` });
    } catch (err) { toast({ title: "Sprint couldn't run", description: err?.message, variant: "destructive" }); }
    finally { setWorking(false); }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading Titan Auto" />;
  if (!user) return <EmptyState title="Sign in to use Titan Auto" description="Automation runs are tied to your verified TitanOS account." actionLabel="Sign in" onAction={() => { window.location.href = "/login"; }} />;
  if (loading) return <PageLoader variant="list" label="Loading Titan Auto workspace" />;
  if (error) return <ErrorState title="Couldn't load Titan Auto" onRetry={reload} />;

  return (
    <div className="page-pad max-w-5xl mx-auto pb-24">
      <PageHeader
        eyebrow="Second Me execution layer"
        title="Titan Auto"
        subtitle="One approved automation layer for your job search, independent work, and business workflows."
      />

      <section className="titan-surface p-5 mb-5">
        <div className="flex gap-3 items-start">
          <Workflow className="w-7 h-7 text-titan-cyan" />
          <div>
            <h2 className="text-lg font-semibold">TitanOS-native automation</h2>
            <p className="text-sm text-muted-foreground mt-1">Titan Auto uses your authorized TitanOS context, but execution remains bounded by the same account permissions, confirmations, and safety controls as the rest of TitanOS.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-5">
          {AUTOMATION_LANES.map((lane) => (
            <Link key={lane.title} to={lane.path} className="rounded-lg border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/50 focus-ring">
              <BriefcaseBusiness className="w-5 h-5 mb-3 text-titan-cyan" aria-hidden="true" />
              <h3 className="font-semibold">{lane.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{lane.description}</p>
              <p className="text-sm font-semibold text-primary mt-3">{lane.action}</p>
            </Link>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-5 text-sm">
          <div className="rounded-lg bg-muted p-3"><Bot className="w-4 h-4 mb-2 text-titan-cyan" />TitanAI-assisted preparation</div>
          <div className="rounded-lg bg-muted p-3"><ShieldCheck className="w-4 h-4 mb-2 text-titan-cyan" />Approval-gated execution</div>
          <div className="rounded-lg bg-muted p-3"><CheckCircle2 className="w-4 h-4 mb-2 text-titan-cyan" />Auditable completion</div>
        </div>
      </section>

      {checkout === "success" && returnedOrder && (
        <section className="titan-surface p-5 mb-5 border border-emerald-500/30">
          <div className="flex items-start gap-3"><CheckCircle2 className="w-6 h-6 text-emerald-400" /><div className="flex-1"><h2 className="font-semibold">Payment received</h2><p className="text-sm text-muted-foreground mt-1">Run the approved sprint after Stripe confirms payment. Clicking twice will not send twice.</p></div></div>
          <Button className="mt-4 min-h-11" onClick={runOrder} disabled={working}>{working ? "Checking payment…" : "Send approved reminders"}</Button>
        </section>
      )}

      <section className="titan-surface p-5 mb-5">
        <div className="flex gap-3 items-start"><Mail className="w-7 h-7 text-titan-cyan" /><div><h2 className="text-lg font-semibold">Invoice Recovery Sprint</h2><p className="text-sm text-muted-foreground mt-1">The first live Titan Auto workflow: prepare one approved reminder for up to 10 overdue invoices. Included monthly with a paid Pro or Business membership; reminders send automatically when email delivery is configured.</p></div></div>
        {!paidMembership && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-titan-cyan/30 bg-titan-cyan/5 p-4">
            <div className="flex-1"><p className="font-semibold">Put invoice follow-up on repeat</p><p className="text-sm text-muted-foreground mt-1">Pro includes one recovery sprint every month, plus the full TitanOS Pro toolkit.</p></div>
            <Button asChild className="min-h-11 shrink-0"><a href={getPlanCheckoutUrl("worker_premium")} target="_blank" rel="noopener noreferrer">Get Pro · $9.99/month <ExternalLink className="w-4 h-4" /></a></Button>
          </div>
        )}
      </section>

      <section className="titan-surface p-5">
        <h2 className="font-semibold">Select overdue invoices <span className="text-muted-foreground font-normal">({selected.length}/10)</span></h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Only unpaid, past-due invoices with a customer email are eligible.</p>
        {eligible.length ? eligible.map((invoice) => (
          <label key={invoice.id} className="flex items-center gap-3 py-3 border-b border-border cursor-pointer min-h-14">
            <input type="checkbox" className="w-5 h-5" checked={selected.includes(invoice.id)} onChange={() => toggle(invoice.id)} disabled={!selected.includes(invoice.id) && selected.length >= 10} />
            <span className="flex-1"><span className="block font-medium">{invoice.customer_name || "Customer"}</span><span className="text-xs text-muted-foreground">{invoice.invoice_number || "Invoice"} · {invoice.customer_email} · due {invoice.due_date}</span></span>
            <span className="font-semibold tabular-nums">${Number(invoice.balance_due ?? invoice.total).toFixed(2)}</span>
          </label>
        )) : <EmptyState title="No eligible invoices" description="Add a customer email and due date to an unpaid invoice; it will appear here after its due date." actionLabel="Open invoices" onAction={() => { window.location.href = "/invoices"; }} />}
        {eligible.length > 0 && paidMembership && <Button className="w-full sm:w-auto mt-5 min-h-11" disabled={!selected.length || working} onClick={runMembership}>{working ? "Running approved sprint…" : "Run this month's included sprint"}</Button>}
        {eligible.length > 0 && showOneTime && <Button variant="outline" className="w-full sm:w-auto mt-5 sm:ml-2 min-h-11" disabled={!selected.length || working} onClick={checkoutNow}>{working ? "Opening secure checkout…" : <>One-time sprint · $9 <ExternalLink className="w-4 h-4" /></>}</Button>}
      </section>
    </div>
  );
}
