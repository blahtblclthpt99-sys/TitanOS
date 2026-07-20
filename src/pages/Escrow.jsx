import React, { useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import FormField from "@/components/shared/FormField";
import DeleteButton from "@/components/shared/DeleteButton";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import {
  confirmEscrowSide,
  createEscrowHold,
  deleteEscrowHold,
  listEscrowHolds,
  updateEscrowHold,
} from "@/lib/escrowApi";

export default function Escrow() {
  const { user } = useAuth();
  const { data: rows = [], setData: setRows, loading, error, reload } = useSafeAsync(
    () => listEscrowHolds(user.id),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );
  const [form, setForm] = useState({ customer_name: "", job_title: "", amount: "" });

  const add = async (e) => {
    e.preventDefault();
    if (!form.customer_name || !Number(form.amount)) return;
    const row = await createEscrowHold(user, form);
    setRows([row, ...rows]);
    setForm({ customer_name: "", job_title: "", amount: "" });
  };

  const confirm = async (row, side) => {
    const saved = await confirmEscrowSide(user.id, row, side);
    setRows(rows.map((r) => (r.id === row.id ? saved : r)));
  };

  const refund = async (row) => {
    const saved = await updateEscrowHold(user.id, row.id, { status: "refunded" });
    setRows(rows.map((r) => (r.id === row.id ? saved : r)));
  };

  if (loading) return <PageLoader variant="list" label="Loading job holds" />;
  if (error) return <ErrorState title="Couldn't load job holds" onRetry={reload} />;

  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="Money · Beta"
        title="Job holds"
        subtitle="Track mutual confirmation before you mark a job complete. This does not move or hold real funds yet."
      />
      <div className="mb-5 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-foreground leading-relaxed">
        Status tracking only — TitanOS does not charge cards or hold money in escrow during public beta.
        Use Payments when you are ready to collect.
      </div>
      <form onSubmit={add} className="titan-surface p-5 mb-5 space-y-3">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <ShieldCheck className="w-5 h-5" aria-hidden="true" /> New job hold
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <FormField
            label="Customer"
            required
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            placeholder="Customer name"
          />
          <FormField
            label="Job title"
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            placeholder="Job title"
          />
          <FormField
            label="Amount ($)"
            required
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <Button type="submit" className="gap-2">
          <Plus className="w-4 h-4" aria-hidden="true" /> Create hold record
        </Button>
      </form>
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="titan-surface p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{row.customer_name}</p>
                <p className="text-sm text-muted-foreground">{row.job_title || "Protected job"}</p>
              </div>
              <div className="text-right flex items-start gap-1">
                <div>
                  <p className="text-xl font-bold text-foreground">${Number(row.amount || 0).toLocaleString()}</p>
                  <p className="text-xs capitalize text-primary">{row.status}</p>
                </div>
                <DeleteButton
                  label={`hold for ${row.customer_name}`}
                  onDelete={async () => {
                    await deleteEscrowHold(user.id, row.id);
                    setRows((prev) => prev.filter((r) => r.id !== row.id));
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className={row.customer_confirmed ? "text-success" : "text-muted-foreground"}>
                Customer {row.customer_confirmed ? "confirmed" : "pending"}
              </span>
              <span className={row.provider_confirmed ? "text-success" : "text-muted-foreground"}>
                You {row.provider_confirmed ? "confirmed" : "pending"}
              </span>
            </div>
            {row.status === "held" && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => confirm(row, "customer")}>
                  Customer confirms
                </Button>
                <Button size="sm" variant="outline" onClick={() => confirm(row, "provider")}>
                  I confirm done
                </Button>
                <Button size="sm" variant="outline" onClick={() => refund(row)}>
                  Mark refunded
                </Button>
              </div>
            )}
          </article>
        ))}
        {!rows.length && (
          <EmptyState
            icon={ShieldCheck}
            title="No job holds yet"
            description="Create a hold record for large jobs so both sides can confirm completion."
          />
        )}
      </div>
    </PageShell>
  );
}
