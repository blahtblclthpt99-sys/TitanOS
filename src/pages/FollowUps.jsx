import React, { useState } from "react";
import { Check, Send, Mail } from "lucide-react";
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
  listQueue,
  listRules,
  markQueueSent,
  seedDefaultFollowUpRules,
  sendFollowUpNow,
} from "@/lib/followUpApi";

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
      const saved = await markQueueSent(user.id, row.id);
      setData((prev) => ({
        ...prev,
        queue: (prev?.queue ?? []).map((item) => (item.id === row.id ? saved : item)),
      }));
      toast({ title: "Marked as sent" });
    } catch {
      toast({ title: "Couldn't update", variant: "destructive" });
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
        title: saved.send?.stub ? "Follow-up saved — email not delivered" : "Follow-up sent",
        description: saved.send?.message || "Queue item updated.",
      });
    } catch {
      toast({ title: "Couldn't send", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  if (!authChecked || isLoadingAuth) {
    return <PageLoader variant="list" label="Loading follow-ups" />;
  }

  if (!user?.id) {
    return (
      <div className="page-pad max-w-6xl mx-auto pb-24">
        <PageHeader title="Follow-ups" subtitle="Turn completed work into repeat business" />
        <EmptyState
          title="Sign in to manage follow-ups"
          description="Automation rules and the send queue require an account."
          actionLabel="Sign in"
          onAction={() => {
            window.location.href = "/login";
          }}
        />
      </div>
    );
  }

  if (loading) return <PageLoader variant="list" label="Loading follow-ups" />;
  if (error) return <ErrorState title="Couldn't load follow-ups" onRetry={reload} />;

  return (
    <div className="page-pad max-w-6xl mx-auto">
      <PageHeader title="Follow-ups" subtitle="Turn completed work into repeat business" />
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
          {!rules.length && (
            <p className="text-muted-foreground text-sm py-4">No rules yet. Add one below or seed defaults.</p>
          )}
          <form onSubmit={add} className="flex gap-2 mt-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" className="bg-muted border-border text-foreground" />
            <Input value={days} onChange={(e) => setDays(e.target.value)} type="number" className="w-20 bg-muted border-border text-foreground" />
            <Button>Add</Button>
          </form>
        </section>
        <section className="titan-surface p-5">
          <h2 className="font-semibold text-foreground mb-3">Pending queue</h2>
          {queue.filter((row) => row.status === "pending").map((row) => (
            <div key={row.id} className="border-b border-border py-3 flex gap-3">
              <Send className="w-4 h-4 text-titan-cyan mt-1" />
              <div className="flex-1">
                <p className="text-sm text-foreground">{row.customer_name || "Customer"}</p>
                <p className="text-xs text-muted-foreground">{row.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(row.scheduled_for).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Button onClick={() => emailSend(row)} size="sm" disabled={sendingId === row.id}>
                  <Mail className="w-4 h-4" />{sendingId === row.id ? "…" : "Email"}
                </Button>
                <Button onClick={() => sent(row)} size="sm" variant="outline" className="border-border text-foreground">
                  <Check className="w-4 h-4" />Sent
                </Button>
                <DeleteButton
                  label="this follow-up"
                  onDelete={async () => {
                    await deleteQueueItem(user.id, row.id);
                    setData((prev) => ({
                      ...prev,
                      queue: (prev?.queue ?? []).filter((item) => item.id !== row.id),
                    }));
                  }}
                />
              </div>
            </div>
          ))}
          {!queue.some((row) => row.status === "pending") && (
            <EmptyState
              title="No pending follow-ups"
              description="Queued messages will show here when a rule fires after completed work."
            />
          )}
        </section>
      </div>
    </div>
  );
}
