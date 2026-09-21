import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Mail, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import DeleteButton from "@/components/shared/DeleteButton";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import {
  createRule,
  deleteQueueItem,
  deleteRule,
  isAutopilotFollowUp,
  listQueue,
  listRules,
  markQueueSent,
  retryAutopilotFollowUp,
  seedDefaultFollowUpRules,
  sendFollowUpNow,
} from "@/lib/followUpApi";

const RECEIPT_REASON_LABELS = {
  recent_autopilot_reminder: "Stopped: this invoice was reminded within the last 72 hours",
  autopilot_delivery_in_progress: "Stopped: another protected Autopilot delivery is already in progress",
  approved_recipient_changed: "Stopped: the customer email changed after approval",
  approved_recipient_mismatch: "Stopped: the saved recipient no longer matches the approved recipient",
  invoice_no_longer_eligible: "Stopped: the invoice is no longer overdue and unpaid",
  delivery_unconfirmed_invoice_no_longer_eligible: "Stopped: the invoice changed while delivery was being reconciled",
  provider_idempotency_window_expired: "Needs review: the provider-safe retry window expired",
  idempotency_window_expired: "Needs review: the provider-safe retry window expired",
  network_ambiguous: "Safe retry: the provider response could not be confirmed",
  concurrent_idempotent_requests: "Safe retry: the provider is still reconciling the same delivery",
  provider_accepted_receipt_persist_ambiguous: "Safe retry: provider acceptance was received but receipt persistence needs reconciliation",
};

function receiptLabel(row) {
  if (row.provider_message_id) {
    const id = String(row.provider_message_id);
    return `Provider receipt …${id.slice(-8)}`;
  }
  if (row.status === "sent") return "Provider acceptance recorded";
  if (row.delivery_error_code) {
    return RECEIPT_REASON_LABELS[row.delivery_error_code]
      || row.delivery_error_code.replaceAll("_", " ");
  }
  if (row.status === "pending") return "Awaiting safe reconciliation";
  return "Recorded by Titan Autopilot";
}

function statusMeta(status) {
  if (status === "sent") return { label: "Sent", icon: CheckCircle2 };
  if (status === "failed") return { label: "Needs review", icon: AlertTriangle };
  if (status === "skipped") return { label: "Stopped", icon: ShieldCheck };
  return { label: "Safe retry", icon: RefreshCw };
}

export default function FollowUps() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const { data, setData, loading, error, reload } = useSafeAsync(
    async () => {
      const [rules, queue] = await Promise.all([listRules(user.id), listQueue(user.id)]);
      return { rules, queue };
    },
    [user?.id],
    { enabled: Boolean(user?.id), initial: { rules: [], queue: [] } }
  );
  const rules = data?.rules ?? [];
  const queue = data?.queue ?? [];
  const normalPending = useMemo(
    () => queue.filter((row) => row.status === "pending" && !isAutopilotFollowUp(row)),
    [queue]
  );
  const autopilotRows = useMemo(
    () => queue.filter(isAutopilotFollowUp).slice().sort((a, b) => new Date(b.created_at || b.scheduled_for || 0) - new Date(a.created_at || a.scheduled_for || 0)),
    [queue]
  );
  const [name, setName] = useState("");
  const [days, setDays] = useState("7");
  const [sendingId, setSendingId] = useState(null);

  const add = async (e) => {
    e.preventDefault();
    if (!name || !user?.id) return;
    try {
      const row = await createRule(user, {
        name,
        delay_days: Number(days),
        message_template: `Hi {customer_name}, checking in from TitanOS.`,
      });
      setData((prev) => ({ ...prev, rules: [...(prev?.rules ?? []), row] }));
      setName("");
      toast({ title: "Rule added" });
    } catch {
      toast({ title: "Couldn't add rule", variant: "destructive" });
    }
  };

  const sent = async (row) => {
    try {
      const saved = await markQueueSent(user.id, row.id, row);
      setData((prev) => ({
        ...prev,
        queue: (prev?.queue ?? []).map((item) => (item.id === row.id ? saved : item)),
      }));
      toast({ title: "Marked as sent" });
    } catch (err) {
      toast({ title: "Couldn't update", description: err?.message, variant: "destructive" });
    }
  };

  const emailSend = async (row) => {
    setSendingId(row.id);
    try {
      const saved = await sendFollowUpNow(user, row);
      setData((prev) => ({
        ...prev,
        queue: (prev?.queue ?? []).map((item) => (item.id === row.id ? saved : item)),
      }));
      toast({
        title: "Follow-up sent",
        description: saved.send?.message || "Queue item updated.",
      });
    } catch (err) {
      toast({ title: "Couldn't send", description: err?.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const retryAutopilot = async (row) => {
    setSendingId(row.id);
    try {
      const result = await retryAutopilotFollowUp(user, row);
      await reload();
      const retryable = result?.retryable === true || Number(result?.pending || 0) > 0;
      toast({
        title: retryable ? "Autopilot still needs a safe retry" : "Autopilot recovery reconciled",
        description: `${result?.sent || 0} sent · ${result?.failed || 0} failed · ${result?.skipped || 0} stopped · ${result?.pending || 0} pending`,
        variant: !retryable && result?.success === false ? "destructive" : undefined,
      });
    } catch (err) {
      toast({ title: "Couldn't retry Autopilot safely", description: err?.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading follow-ups" />;

  if (!user?.id) {
    return (
      <div className="page-pad max-w-6xl mx-auto pb-24">
        <PageHeader title="Follow-ups" subtitle="Turn completed work into repeat business" />
        <EmptyState
          title="Sign in to manage follow-ups"
          description="Automation rules and the send queue require an account."
          actionLabel="Sign in"
          onAction={() => { window.location.href = "/login"; }}
        />
      </div>
    );
  }

  if (loading) return <PageLoader variant="list" label="Loading follow-ups" />;
  if (error) return <ErrorState title="Couldn't load follow-ups" onRetry={reload} />;

  return (
    <div className="page-pad max-w-6xl mx-auto pb-24">
      <PageHeader title="Follow-ups" subtitle="Manual follow-ups and read-only Titan Autopilot recovery evidence" />
      <div className="flex justify-end mb-4">
        <Button
          type="button"
          onClick={async () => {
            try {
              await seedDefaultFollowUpRules(user);
              reload();
              toast({ title: "Default rules seeded" });
            } catch {
              toast({ title: "Couldn't seed defaults", variant: "destructive" });
            }
          }}
        >
          Seed defaults
        </Button>
      </div>

      {autopilotRows.length > 0 && (
        <section className="titan-surface p-5 mb-5 border border-titan-cyan/25">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-titan-cyan" aria-hidden />
                <h2 className="font-semibold text-foreground">Autopilot Recovery Receipts</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                These records are read-only evidence from Titan Autopilot. Sent rows preserve provider acceptance; stopped rows were blocked by a safety check; pending free-run rows can be reconciled here using the original run and provider idempotency key.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => { window.location.href = "/autopilot"; }}>
              Open Recovery Command Center
            </Button>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {autopilotRows.slice(0, 20).map((row) => {
              const meta = statusMeta(row.status);
              const StatusIcon = meta.icon;
              return (
                <div key={row.id} className="py-3.5 flex gap-3 items-start">
                  <StatusIcon className="w-4 h-4 text-titan-cyan mt-1 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{row.customer_name || "Customer"}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{row.message}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                      <span>{receiptLabel(row)}</span>
                      <span>{new Date(row.sent_at || row.created_at || row.scheduled_for).toLocaleString()}</span>
                    </div>
                  </div>
                  {row.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retryAutopilot(row)}
                      disabled={sendingId === row.id}
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                      {sendingId === row.id ? "Reconciling…" : "Retry safely"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {autopilotRows.length > 20 && (
            <p className="text-xs text-muted-foreground mt-3">Showing the 20 most recent Autopilot recovery records.</p>
          )}
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="titan-surface p-5">
          <h2 className="font-semibold text-foreground mb-3">Automation rules</h2>
          {rules.map((rule) => (
            <div key={rule.id} className="py-3 border-b border-border text-sm flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <span className="text-foreground">{rule.name}</span>
                <span className="float-right text-titan-cyan">{rule.delay_days} days</span>
                <p className="text-xs text-muted-foreground mt-1">{rule.message_template}</p>
              </div>
              <DeleteButton
                label={`rule “${rule.name}”`}
                onDelete={async () => {
                  await deleteRule(user.id, rule.id);
                  setData((prev) => ({
                    ...prev,
                    rules: (prev?.rules ?? []).filter((r) => r.id !== rule.id),
                  }));
                }}
              />
            </div>
          ))}
          {!rules.length && <p className="text-muted-foreground text-sm py-4">No rules yet. Add one below or seed defaults.</p>}
          <form onSubmit={add} className="flex gap-2 mt-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" className="bg-muted border-border text-foreground" />
            <Input value={days} onChange={(e) => setDays(e.target.value)} type="number" className="w-20 bg-muted border-border text-foreground" />
            <Button>Add</Button>
          </form>
        </section>

        <section className="titan-surface p-5">
          <h2 className="font-semibold text-foreground mb-3">Manual pending queue</h2>
          {normalPending.map((row) => (
            <div key={row.id} className="border-b border-border py-3 flex gap-3">
              <Send className="w-4 h-4 text-titan-cyan mt-1" aria-hidden />
              <div className="flex-1">
                <p className="text-sm text-foreground">{row.customer_name || "Customer"}</p>
                <p className="text-xs text-muted-foreground">{row.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(row.scheduled_for).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Button onClick={() => emailSend(row)} size="sm" disabled={sendingId === row.id}>
                  <Mail className="w-4 h-4" aria-hidden />{sendingId === row.id ? "…" : "Email"}
                </Button>
                <Button onClick={() => sent(row)} size="sm" variant="outline" className="border-border text-foreground">
                  <Check className="w-4 h-4" aria-hidden />Sent
                </Button>
                <DeleteButton
                  label="this follow-up"
                  onDelete={async () => {
                    await deleteQueueItem(user.id, row.id, row);
                    setData((prev) => ({
                      ...prev,
                      queue: (prev?.queue ?? []).filter((item) => item.id !== row.id),
                    }));
                  }}
                />
              </div>
            </div>
          ))}
          {!normalPending.length && (
            <EmptyState
              title="No manual pending follow-ups"
              description="Queued messages from ordinary follow-up rules will show here. Autopilot recovery records are protected above."
            />
          )}
        </section>
      </div>
    </div>
  );
}
