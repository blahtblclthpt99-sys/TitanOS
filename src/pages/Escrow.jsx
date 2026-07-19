import React, { useEffect, useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import {
  confirmEscrowSide,
  createEscrowHold,
  listEscrowHolds,
  updateEscrowHold,
} from "@/lib/escrowApi";

export default function Escrow() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ customer_name: "", job_title: "", amount: "" });

  const load = async () => {
    if (user?.id) setRows(await listEscrowHolds(user.id));
  };
  useEffect(() => {
    load();
  }, [user?.id]);

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

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28">
      <PageHeader title="Payment Protection" subtitle="Hold funds in escrow until both sides confirm the job is done" />
      <form onSubmit={add} className="glass rounded-2xl p-5 mb-5 space-y-3">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <ShieldCheck className="w-5 h-5" /> New escrow hold
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer" className="bg-muted border-border text-foreground" />
          <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} placeholder="Job title" className="bg-muted border-border text-foreground" />
          <Input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount ($)" className="bg-muted border-border text-foreground" />
        </div>
        <Button type="submit"><Plus className="w-4 h-4" /> Hold payment</Button>
      </form>
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{row.customer_name}</p>
                <p className="text-sm text-muted-foreground">{row.job_title || "Protected job"}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">${Number(row.amount || 0).toLocaleString()}</p>
                <p className="text-xs capitalize text-primary">{row.status}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className={row.customer_confirmed ? "text-emerald-400" : "text-muted-foreground"}>
                Customer {row.customer_confirmed ? "✓" : "○"}
              </span>
              <span className={row.provider_confirmed ? "text-emerald-400" : "text-muted-foreground"}>
                Provider {row.provider_confirmed ? "✓" : "○"}
              </span>
            </div>
            {row.status === "held" && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => confirm(row, "customer")}>Customer confirms</Button>
                <Button size="sm" variant="outline" onClick={() => confirm(row, "provider")}>I confirm done</Button>
                <Button size="sm" variant="outline" onClick={() => refund(row)}>Refund</Button>
              </div>
            )}
          </article>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">No escrow holds yet — protect large jobs before work starts.</p>}
      </div>
    </div>
  );
}
