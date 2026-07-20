import React, { useState } from "react";
import { Check, Send, Mail } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
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
  const { user } = useAuth();
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
    if (!name) return;
    const row = await createRule(user, {
      name,
      delay_days: Number(days),
      message_template: `Hi {customer_name}, checking in from TitanOS.`,
    });
    setData((prev) => ({ ...prev, rules: [...(prev?.rules ?? []), row] }));
    setName("");
  };

  const sent = async (row) => {
    const saved = await markQueueSent(user.id, row.id);
    setData((prev) => ({
      ...prev,
      queue: (prev?.queue ?? []).map((item) => (item.id === row.id ? saved : item)),
    }));
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
        title: saved.send?.stub ? "Marked sent (email stub)" : "Follow-up sent",
        description: saved.send?.message || "Queue item updated.",
      });
    } catch {
      toast({ title: "Couldn't send", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading follow-ups" />;
  if (error) return <ErrorState title="Couldn't load follow-ups" onRetry={reload} />;

  return (
    <div className="page-pad max-w-6xl mx-auto">
      <PageHeader title="Follow-ups" subtitle="Turn completed work into repeat business" />
      <div className="flex justify-end mb-4">
        <Button
          type="button"
          onClick={async () => {
            await seedDefaultFollowUpRules(user);
            reload();
          }}
        >
          Seed defaults
        </Button>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="glass rounded-2xl p-5">
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
          <form onSubmit={add} className="flex gap-2 mt-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" className="bg-muted border-border text-foreground" />
            <Input value={days} onChange={(e) => setDays(e.target.value)} type="number" className="w-20 bg-muted border-border text-foreground" />
            <Button>Add</Button>
          </form>
        </section>
        <section className="glass rounded-2xl p-5">
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
            <p className="text-muted-foreground text-sm py-8">No pending follow-ups.</p>
          )}
        </section>
      </div>
    </div>
  );
}
