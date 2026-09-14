import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useSearchParams } from "react-router";
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

const DAY_MS = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const balanceOf = (invoice) => Math.max(0, Number(invoice?.balance_due ?? invoice?.total ?? 0) || 0);

function daysOverdue(invoice) {
  if (!invoice?.due_date) return 0;
  const due = new Date(`${invoice.due_date}T00:00:00`).getTime();
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.floor((Date.now() - due) / DAY_MS));
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function ExamplePreview() {
  const rows = [
    { id: "INV-2041", customer: "Sample customer A", age: "34 days overdue", balance: "$840.00" },
    { id: "INV-2053", customer: "Sample customer B", age: "18 days overdue", balance: "$465.00" },
    { id: "INV-2060", customer: "Sample customer C", age: "9 days overdue", balance: "$220.00" },
  ];

  return (
    <section className="titan-surface overflow-hidden border border-titan-cyan/25">
      <div className="border-b border-border bg-titan-cyan/5 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-titan-cyan">Example preview · sample data</p>
          <h2 className="text-lg font-semibold mt-1">Recovery Command Center</h2>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Owner approval required
        </span>
      </div>
      <div className="p-5 space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className="rounded-xl border border-border bg-card/70 p-4 flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-titan-cyan/10 text-titan-cyan flex items-center justify-center font-semibold text-sm">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{row.customer}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{row.id} · {row.age}</p>
            </div>
            <p className="font-semibold tabular-nums">{row.balance}</p>
          </div>
        ))}
        <div className="grid sm:grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl bg-muted/45 p-3">
            <p className="text-xs text-muted-foreground">1. Detect</p>
            <p className="text-sm font-medium mt-1">Find overdue balances</p>
          </div>
          <div className="rounded-xl bg-muted/45 p-3">
            <p className="text-xs text-muted-foreground">2. Approve</p>
            <p className="text-sm font-medium mt-1">Choose exact recipients</p>
          </div>
          <div className="rounded-xl bg-muted/45 p-3">
            <p className="text-xs text-muted-foreground">3. Execute</p>
            <p className="text-sm font-medium mt-1">Send + audit every result</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicAutopilot() {
  return (
    <div className="page-pad max-w-5xl mx-auto pb-24">
      <PageHeader
        title="Titan Autopilot"
        subtitle="Turn overdue invoices into approved, trackable follow-ups — without spending your day chasing payments."
      />

      <section className="titan-surface p-5 sm:p-7 mb-5 border border-titan-cyan/25">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-titan-cyan">Invoice recovery, with you in control</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
            Approve the customers. Titan handles the repetitive follow-up.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed">
            Titan Autopilot finds eligible overdue invoices, lets you approve up to 10 recipients, sends one factual payment reminder, and records the outcome. If an invoice is paid before execution, the reminder is stopped automatically.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <Eye className="w-5 h-5 text-titan-cyan" aria-hidden />
            <p className="font-medium mt-3">Nothing hidden</p>
            <p className="text-xs text-muted-foreground mt-1">You see and approve every recipient before Titan acts.</p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <ShieldCheck className="w-5 h-5 text-titan-cyan" aria-hidden />
            <p className="font-medium mt-3">Paid-invoice safety stop</p>
            <p className="text-xs text-muted-foreground mt-1">Eligibility is checked again immediately before delivery.</p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <CheckCircle2 className="w-5 h-5 text-titan-cyan" aria-hidden />
            <p className="font-medium mt-3">Auditable execution</p>
            <p className="text-xs text-muted-foreground mt-1">Sent, failed, skipped, and retry-needed outcomes stay visible instead of disappearing.</p>
          </div>
        </div>
      </section>

      <ExamplePreview />

      <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold">Use your real invoice data</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in to see eligible overdue invoices and approve your first recovery batch.</p>
        </div>
        <Button className="min-h-11 shrink-0 gap-2" onClick={() => { window.location.href = "/login"; }}>
          Open Titan Autopilot <ArrowRight className="w-4 h-4" aria-hidden />
        </Button>
      </section>

      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
        Titan Autopilot is a follow-up workflow, not a collections agency and not a payment guarantee. It only works with customer records you already own and invoices you select.
      </p>
    </div>
  );
}

export default function Autopilot() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const returnedOrder = searchParams.get("order");
  const checkout = searchParams.get("checkout");
  const [selected, setSelected] = useState([]);
  const [working, setWorking] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const paidMembership = user?.paying_subscriber === true && ["worker_premium", "pro", "business"].includes(resolvePlan(user));
  const showOneTime = import.meta.env.VITE_AUTOPILOT_ONETIME_CHECKOUT === "true";
  const { data: invoices = [], loading, error, reload } = useSafeAsync(
    () => api.entities.Invoice.list("due_date", 200),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );

  const eligible = useMemo(() => invoices
    .filter((invoice) =>
      invoice.status !== "paid" &&
      invoice.customer_email &&
      invoice.due_date &&
      invoice.due_date < today() &&
      balanceOf(invoice) > 0
    )
    .sort((a, b) => {
      const ageDiff = daysOverdue(b) - daysOverdue(a);
      return ageDiff || balanceOf(b) - balanceOf(a);
    }), [invoices]);

  const selectedRows = useMemo(
    () => selected.map((id) => eligible.find((invoice) => invoice.id === id)).filter(Boolean),
    [eligible, selected]
  );
  const eligibleBalance = useMemo(() => eligible.reduce((sum, invoice) => sum + balanceOf(invoice), 0), [eligible]);
  const selectedBalance = useMemo(() => selectedRows.reduce((sum, invoice) => sum + balanceOf(invoice), 0), [selectedRows]);
  const previewInvoice = selectedRows[0] || null;

  const toggle = (id) => setSelected((current) =>
    current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 10
        ? [...current, id]
        : current
  );

  const selectPriorityBatch = () => setSelected(eligible.slice(0, 10).map((invoice) => invoice.id));

  const checkoutNow = async () => {
    setWorking(true);
    try {
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
      setLastResult(result);
      const retryable = result.retryable === true || Number(result.pending || 0) > 0;
      toast({
        title: retryable
          ? "Safe retry required"
          : result.duplicate
            ? "Sprint already completed"
            : "Recovery sprint completed",
        description: `${result.sent || 0} sent · ${result.failed || 0} failed · ${result.skipped || 0} skipped · ${result.pending || 0} pending`,
      });
    } catch (err) {
      toast({ title: "Sprint isn't ready", description: err?.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const runMembership = async () => {
    setWorking(true);
    try {
      const result = await api.functions.invoke("runAutopilotMembership", { invoice_ids: selected });
      setLastResult(result);
      const queued = result.delivery_mode === "review_queue";
      const retryable = result.retryable === true || Number(result.pending || 0) > 0;
      toast({
        title: retryable
          ? "Safe retry required"
          : queued
            ? "Reminders prepared for review"
            : "Included recovery sprint completed",
        description: queued
          ? `${result.prepared || 0} ready in Follow-ups · ${result.skipped || 0} skipped`
          : `${result.sent || 0} sent · ${result.failed || 0} failed · ${result.skipped || 0} skipped · ${result.pending || 0} pending`,
      });
    } catch (err) {
      toast({ title: "Sprint couldn't run", description: err?.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading Titan Autopilot" />;
  if (!user) return <PublicAutopilot />;
  if (loading) return <PageLoader variant="list" label="Finding overdue invoices" />;
  if (error) return <ErrorState title="Couldn't load invoice recovery" onRetry={reload} />;

  return (
    <div className="page-pad max-w-5xl mx-auto pb-24">
      <PageHeader
        title="Titan Autopilot"
        subtitle="Turn overdue invoices into approved, trackable follow-ups."
      />

      <section className="titan-surface p-5 sm:p-6 mb-5 border border-titan-cyan/25">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex gap-3 items-start">
              <div className="h-10 w-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-titan-cyan" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium text-titan-cyan">Recovery Command Center</p>
                <h2 className="text-xl font-semibold mt-1">Approve the work. Titan handles the repetition.</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  Titan ranks eligible invoices by age, you choose the exact recipients, and every delivery is rechecked and audited before it leaves.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:w-[320px]">
            <div className="rounded-xl border border-border bg-card/70 p-3">
              <p className="text-xs text-muted-foreground">Eligible balance</p>
              <p className="text-lg font-semibold tabular-nums mt-1">{money(eligibleBalance)}</p>
            </div>
            <div className="rounded-xl border border-titan-cyan/25 bg-titan-cyan/5 p-3">
              <p className="text-xs text-muted-foreground">Approved batch</p>
              <p className="text-lg font-semibold tabular-nums mt-1">{money(selectedBalance)}</p>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-5 text-sm">
          <div className="rounded-lg bg-muted/50 p-3"><Mail className="w-4 h-4 mb-2 text-titan-cyan" aria-hidden />One factual reminder per invoice</div>
          <div className="rounded-lg bg-muted/50 p-3"><ShieldCheck className="w-4 h-4 mb-2 text-titan-cyan" aria-hidden />Paid-after-approval safety stop</div>
          <div className="rounded-lg bg-muted/50 p-3"><CheckCircle2 className="w-4 h-4 mb-2 text-titan-cyan" aria-hidden />Provider-idempotent audited execution</div>
        </div>

        {!paidMembership && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-titan-cyan/30 bg-titan-cyan/5 p-4">
            <div className="flex-1">
              <p className="font-semibold">Put invoice follow-up on repeat</p>
              <p className="text-sm text-muted-foreground mt-1">Pro includes one recovery sprint every month, plus the full TitanOS Pro toolkit.</p>
            </div>
            <Button asChild className="min-h-11 shrink-0">
              <a href={getPlanCheckoutUrl("worker_premium")} target="_blank" rel="noopener noreferrer">
                Get Pro · $9.99/month <ExternalLink className="w-4 h-4" aria-hidden />
              </a>
            </Button>
          </div>
        )}
      </section>

      {checkout === "success" && returnedOrder && (
        <section className="titan-surface p-5 mb-5 border border-emerald-500/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" aria-hidden />
            <div className="flex-1">
              <h2 className="font-semibold">Checkout complete — verifying payment</h2>
              <p className="text-sm text-muted-foreground mt-1">Returning from Stripe does not unlock delivery by itself. Titan verifies a signed Stripe webhook and settled payment before sending anything.</p>
            </div>
          </div>
          <Button className="mt-4 min-h-11" onClick={runOrder} disabled={working}>
            {working ? "Verifying and running…" : "Verify payment and run approved sprint"}
          </Button>
        </section>
      )}

      {checkout === "canceled" && (
        <section className="rounded-2xl border border-border bg-card/60 p-4 mb-5">
          <p className="font-medium">Checkout canceled</p>
          <p className="text-sm text-muted-foreground mt-1">Nothing was sent. Your invoices are unchanged.</p>
        </section>
      )}

      {lastResult && (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 mb-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">{lastResult.retryable ? "Autopilot needs a safe retry" : "Autopilot run recorded"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {lastResult.sent || 0} sent · {lastResult.prepared || 0} prepared · {lastResult.failed || 0} failed · {lastResult.skipped || 0} skipped · {lastResult.pending || 0} pending
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {lastResult.retryable
                  ? "A provider response was ambiguous. Titan kept that delivery pending so retrying can reuse the same idempotency key instead of risking a duplicate."
                  : "Skipped invoices include balances that were no longer eligible when Titan rechecked them."}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="titan-surface p-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Approve overdue invoices <span className="text-muted-foreground font-normal">({selected.length}/10)</span></h2>
            <p className="text-sm text-muted-foreground mt-1">Oldest overdue invoices appear first; balance breaks ties. Titan never selects recipients without your approval.</p>
          </div>
          {eligible.length > 0 && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-10" onClick={selectPriorityBatch} disabled={working}>
                Select oldest {Math.min(10, eligible.length)}
              </Button>
              {selected.length > 0 && (
                <Button type="button" variant="ghost" className="min-h-10" onClick={() => setSelected([])} disabled={working}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {eligible.length ? (
          <div className="mt-4">
            {eligible.map((invoice) => {
              const overdue = daysOverdue(invoice);
              const checked = selected.includes(invoice.id);
              return (
                <label
                  key={invoice.id}
                  className="flex items-center gap-3 py-3.5 border-b border-border cursor-pointer min-h-16"
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 shrink-0"
                    checked={checked}
                    onChange={() => toggle(invoice.id)}
                    disabled={!checked && selected.length >= 10}
                    aria-label={`Approve ${invoice.invoice_number || "invoice"} for ${invoice.customer_name || "customer"}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{invoice.customer_name || "Customer"}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" aria-hidden /> {overdue}d overdue
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 block truncate">
                      {invoice.invoice_number || "Invoice"} · {invoice.customer_email} · due {invoice.due_date}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums shrink-0">{money(balanceOf(invoice))}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No eligible invoices"
              description="Add a customer email and due date to an unpaid invoice; it will appear here after its due date."
              actionLabel="Open invoices"
              onAction={() => { window.location.href = "/invoices"; }}
            />
          </div>
        )}

        {previewInvoice && (
          <div className="mt-5 rounded-xl border border-border bg-muted/25 p-4">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-titan-cyan shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Reminder preview</p>
                <p className="text-xs text-muted-foreground mt-1">Previewing the first approved invoice. Each reminder uses that invoice's current customer, balance, number, and due date.</p>
                <div className="mt-3 rounded-lg border border-border bg-card p-3 text-sm leading-relaxed whitespace-pre-line">
                  {`Hi ${previewInvoice.customer_name || "there"},\n\nThis is a friendly reminder that invoice ${previewInvoice.invoice_number || previewInvoice.id} for ${money(balanceOf(previewInvoice))} was due ${previewInvoice.due_date}. Please contact us if you have already paid or need help with payment.\n\nThank you.`}
                </div>
              </div>
            </div>
          </div>
        )}

        {selected.length > 0 && (
          <div className="mt-5 rounded-xl border border-titan-cyan/25 bg-titan-cyan/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-titan-cyan" aria-hidden />
                <p className="font-semibold">{money(selectedBalance)} selected across {selected.length} invoice{selected.length === 1 ? "" : "s"}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">This is the overdue balance being followed up on — not guaranteed recovered revenue.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {paidMembership && (
                <Button className="min-h-11" disabled={working} onClick={runMembership}>
                  {working ? "Running approved sprint…" : "Run included sprint"}
                </Button>
              )}
              {showOneTime && (
                <Button variant={paidMembership ? "outline" : "default"} className="min-h-11" disabled={working} onClick={checkoutNow}>
                  {working ? "Opening secure checkout…" : <>One-time sprint · $9 <ExternalLink className="w-4 h-4" aria-hidden /></>}
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-5 grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Guardrail</p>
          <p className="font-medium mt-1">No cold outreach</p>
          <p className="text-xs text-muted-foreground mt-2">Only customers already attached to invoices in your account can be selected.</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Recovery</p>
          <p className="font-medium mt-1">Crash-safe execution</p>
          <p className="text-xs text-muted-foreground mt-2">Interrupted sends recover with the same provider idempotency key instead of blindly sending a second email.</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">Truth</p>
          <p className="font-medium mt-1">No fake collection claims</p>
          <p className="text-xs text-muted-foreground mt-2">Titan reports delivery outcomes. It never claims a reminder guarantees payment.</p>
        </div>
      </section>
    </div>
  );
}
