import React, { useEffect, useState } from "react";
import { Gift, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import {
  awardPoints,
  createLoyaltyMember,
  deleteLoyaltyMember,
  listLoyaltyMembers,
} from "@/lib/loyaltyApi";

export default function Loyalty() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");

  const load = async () => {
    if (user?.id) setRows(await listLoyaltyMembers(user.id));
  };
  useEffect(() => {
    load();
  }, [user?.id]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const row = await createLoyaltyMember(user, { customer_name: name.trim(), points: 50 });
    setRows([row, ...rows]);
    setName("");
  };

  const bump = async (row, delta) => {
    const saved = await awardPoints(user, row, delta, delta > 0 ? "Reward points" : "Redeemed");
    setRows(rows.map((m) => (m.id === row.id ? saved : m)));
  };

  const remove = async (id) => {
    await deleteLoyaltyMember(user.id, id);
    setRows(rows.filter((r) => r.id !== id));
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28">
      <PageHeader title="Loyalty Program" subtitle="Points, tiers, and rewards for repeat customers" />
      <form onSubmit={add} className="glass rounded-2xl p-4 flex gap-2 mb-5">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" className="bg-muted border-border text-foreground" />
        <Button type="submit"><Plus className="w-4 h-4" />Add member</Button>
      </form>
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map((row) => (
          <article key={row.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" />
                  {row.customer_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{row.tier} tier</p>
              </div>
              <button type="button" onClick={() => remove(row.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-3xl font-bold text-foreground mt-3">{row.points}</p>
            <p className="text-xs text-muted-foreground mb-3">points</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => bump(row, 100)}>+100 job</Button>
              <Button size="sm" variant="outline" onClick={() => bump(row, -50)}>Redeem 50</Button>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && <p className="text-sm text-muted-foreground mt-4">Add members to start awarding points after completed jobs.</p>}
    </div>
  );
}
