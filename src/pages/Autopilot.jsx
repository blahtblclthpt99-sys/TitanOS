import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { toast } from "@/components/ui/use-toast";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { trackAutopilotEvent } from "@/lib/autopilotTelemetry";

const DAY_MS = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const balanceOf = (invoice) => Math.max(0, Number(invoice?.balance_due ?? invoice?.total ?? 0) || 0);
const recipientKey = (invoice) => String(invoice?.customer_email || "").trim().toLowerCase();

function daysOverdue(invoice) {
  if (!invoice?.due_date) return 0;
  const due = new Date(`${invoice.due_date}T00:00:00`).getTime();
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.floor((Date.now() - due) / DAY_MS));
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

export default function Autopilot() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const [selected, setSelected] = useState([]);
  const [working, setWorking] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const signedViewTracked = useRef(false);
  const eligibleTracked = useRef(false);
  const batchTracked = useRef(false);

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

  const uniqueEligibleCount = useMemo(
    () => new Set(eligible.map(recipientKey).filter(Boolean)).size,
    [eligible]
  );
  const selectedRows = useMemo(
    () => selected.map((id) => eligible.find((invoice) => invoice.id === id)).filter(Boolean),
    [eligible, selected]
  );
  const eligibleBalance = useMemo(
    () => eligible.reduce((sum, invoice) => sum + balanceOf(invoice), 0),
    [eligible]
  );
  const selectedBalance = useMemo(
    () => selectedRows.reduce((sum, invoice) => sum + balanceOf(invoice), 0),
    [selectedRows]
  );
  const previewInvoice = selectedRows[0] || null;

  useEffect(() => {
    if (!user?.id || !authChecked || isLoadingAuth || signedViewTracked.current) return;
    signedViewTracked.current = true;
    void trackAutopilotEvent("signed_in_view", { mode: "free" });
  }, [authChecked, isLoadingAuth, user?.id]);

  useEffect(() => {
    if (!user?.id || loading || error || eligibleTracked.current) return;
    eligibleTracked.current = true;
    void trackAutopilotEvent("eligible_loaded", {
      mode: "free",
      invoiceCount: Math.min(10, uniqueEligibleCount),
    });
  }, [error, loading, uniqueEligibleCount, user?.id]);

  useEffect(() => {
    if (!user?.id || selected.length === 0 || batchTracked.current) return;
    batchTracked.current = true;
    void trackAutopilotEvent("batch_approved", {
      mode: "free",
      invoiceCount: selected.length,
    });
  }, [selected.length, user?.id]);

  const toggle = (id) => setSelected((current) => {
    if (current.includes(id)) return current.filter((item) => item !== id);
    if (current.length >= 10) return current;

    const candidate = eligible.find((invoice) => invoice.id === id);
    const candidateRecipient = recipientKey(candidate);
    const duplicate = current.some((selectedId) => {
      const selectedInvoice = eligible.find((invoice) => invoice.id === selectedId);
      return candidateRecipient && recipientKey(selectedInvoice) === candidateRecipient;
    });
    if (duplicate) {
      toast({
        title: "Customer already selected",
        description: "Titan sends at most one invoice reminder per customer email in each recovery sprint.",
      });
      return current;
    }
    return [...current, id];
  });

  const selectPriorityBatch = () => {
    const seen = new Set();
    const ids = [];
    for (const invoice of eligible) {
      const key = recipientKey(invoice);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      ids.push(invoice.id);
      if (ids.length === 10) break;
    }
    setSelected(ids);
  };

  const runFree = async ({ retry = false } = {}) => {
    if (retry && !lastResult?.run_id) return;
    if (!retry && selected.length === 0) return;

    setWorking(true);
    try {
      const payload = retry
        ? { run_id: lastResult.run_id }
        : { invoice_ids: selected };
      const result = await api.functions.invoke("runAutopilotFree", payload);
      setLastResult(result);
      const retryable = result.retryable === true || Number(result.pending || 0) > 0;
      const terminalFailure = !retryable && result.success === false && Number(result.failed || 0) > 0;
      toast({
        title: retryable
          ? "Safe retry available"
          : terminalFailure
            ? "Recovery sprint finished with failed deliveries"
            : result.duplicate
              ? "Sprint already completed"
              : "Recovery sprint completed",
        description: `${result.sent || 0} sent · ${result.failed || 0} failed · ${result.skipped || 0} stopped · ${result.pending || 0} pending`,
        variant: terminalFailure ? "destructive" : undefined,
      });
      if (!retryable) {
        setSelected([]);
        batchTracked.current = false;
        await reload();
      }
    } catch (err) {
      toast({ title: "Sprint couldn't run", description: err?.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading Titan Autopilot" />;
  if (!user) {
    return (
      <div className="page-pad max-w-3xl mx-auto pb-24">
        <PageHeader title="Titan Autopilot" subtitle="Free invoice follow-up with approval, safety stops, and Recovery Receipts." />
        <section className="titan-surface p-6">
          <p className="font-semibold">Sign in to use your invoice data</p>
          <p className="text-sm text-muted-foreground mt-2">Titan Autopilot is free. Create an account or sign in to approve a recovery sprint.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={() => { window.location.href = "/register?from_url=%2Fautopilot"; }}>Create account</Button>
            <Button variant="outline" onClick={() => { window.location.href = "/login?from_url=%2Fautopilot"; }}>Sign in</Button>
          </div>
        </section>
      </div>
    );
  }
  if (loading) return <PageLoader variant="list" label="Finding overdue invoices" />;
  if (error) return <ErrorState title="Couldn't load invoice recovery" onRetry={reload} />;

  return (
    <div className="page-pad max-w-5xl mx-auto pb-24">
      <PageHeader
        title="Titan Autopilot"
        subtitle="Free, owner-approved follow-up for overdue invoices."
      />

      <section className="titan-surface p-5 sm:p-6 mb-5 border border-titan-cyan/25">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex gap-3 items-start">
              <div className="h-10 w-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-titan-cyan" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-titan-cyan">Recovery Command Center</p>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">Free</span>
                </div>
                <h2 className="text-xl font-semibold mt-1">Approve the work. Titan handles the repetition.</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  Titan ranks eligible invoices by age, you choose the exact recipients, and every delivery is rechecked and audited before it leaves. There is no checkout or paid plan required.
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
          <div className="rounded-lg bg-muted/50 p-3"><Mail className="w-4 h-4 mb-2 text-titan-cyan" aria-hidden />One factual reminder per customer</div>
          <div className="rounded-lg bg-muted/50 p-3"><ShieldCheck className="w-4 h-4 mb-2 text-titan-cyan" aria-hidden />Paid-invoice safety stop</div>
          <div className="rounded-lg bg-muted/50 p-3"><CheckCircle2 className="w-4 h-4 mb-2 text-titan-cyan" aria-hidden />Provider-idempotent audited execution</div>
        </div>
      </section>

      {lastResult && (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 mb-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">{lastResult.retryable ? "Autopilot needs a safe retry" : "Autopilot run recorded"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {lastResult.sent || 0} sent · {lastResult.failed || 0} failed · {lastResult.skipped || 0} stopped · {lastResult.pending || 0} pending
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {lastResult.retryable
                  ? "A provider result is still uncertain. Safe retry reuses this run's exact approved recipients and provider idempotency keys."
                  : "Stopped invoices include balances that became ineligible, were already being handled, or whose approved recipient changed before delivery."}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {lastResult.retryable && (
                  <Button type="button" size="sm" onClick={() => runFree({ retry: true })} disabled={working}>
                    {working ? "Reconciling…" : "Safe retry"}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => { window.location.href = "/follow-ups"; }}>
                  View Recovery Receipts
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="titan-surface p-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Approve overdue invoices <span className="text-muted-foreground font-normal">({selected.length}/10 customers)</span></h2>
            <p className="text-sm text-muted-foreground mt-1">Oldest overdue invoices appear first. Titan allows one invoice per customer email in each sprint so a customer cannot receive several reminders at once.</p>
          </div>
          {eligible.length > 0 && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-10" onClick={selectPriorityBatch} disabled={working}>
                Select oldest {Math.min(10, uniqueEligibleCount)} customers
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
              const duplicateRecipientSelected = !checked && selectedRows.some((row) => recipientKey(row) === recipientKey(invoice));
              return (
                <label
                  key={invoice.id}
                  className={`flex items-center gap-3 py-3.5 border-b border-border min-h-16 ${duplicateRecipientSelected ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 shrink-0"
                    checked={checked}
                    onChange={() => toggle(invoice.id)}
                    disabled={duplicateRecipientSelected || (!checked && selected.length >= 10)}
                    aria-label={`Approve ${invoice.invoice_number || "invoice"} for ${invoice.customer_name || "customer"}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{invoice.customer_name || "Customer"}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" aria-hidden /> {overdue}d overdue
                      </span>
                      {duplicateRecipientSelected && <span className="text-[11px] text-muted-foreground">Customer already selected</span>}
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
                <p className="text-xs text-muted-foreground mt-1">Previewing the first approved invoice. Every reminder is rechecked before sending.</p>
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
                <ReceiptText className="w-4 h-4 text-titan-cyan" aria-hidden />
                <p className="font-semibold">{money(selectedBalance)} selected across {selected.length} customer{selected.length === 1 ? "" : "s"}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">This is the overdue balance being followed up on, not a fee and not guaranteed recovered revenue.</p>
            </div>
            <Button className="min-h-11 shrink-0" disabled={working} onClick={() => runFree()}>
              {working ? "Running approved sprint…" : "Run free recovery sprint"}
            </Button>
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
          <p className="text-xs text-muted-foreground">Access</p>
          <p className="font-medium mt-1">Free for now</p>
          <p className="text-xs text-muted-foreground mt-2">No checkout or paid membership is required. Future monetization is intentionally separate from the recovery workflow.</p>
        </div>
      </section>
    </div>
  );
}
