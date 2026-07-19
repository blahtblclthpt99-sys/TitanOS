import React, { useEffect, useState } from "react";
import { Check, Send } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import { createRule, listQueue, listRules, markQueueSent, seedDefaultFollowUpRules } from "@/lib/followUpApi";

export default function FollowUps() {
  const { user } = useAuth(); const [rules, setRules] = useState([]); const [queue, setQueue] = useState([]); const [name, setName] = useState(""); const [days, setDays] = useState("7");
  const load = async () => { if (!user?.id) return; const [r, q] = await Promise.all([listRules(user.id), listQueue(user.id)]); setRules(r); setQueue(q); };
  useEffect(() => { load(); }, [user?.id]);
  const add = async (e) => { e.preventDefault(); if (!name) return; const row = await createRule(user, { name, delay_days: Number(days), message_template: `Hi {customer_name}, checking in from TitanOS.` }); setRules([...rules, row]); setName(""); };
  const sent = async (row) => { const saved = await markQueueSent(user.id, row.id); setQueue(queue.map((item) => item.id === row.id ? saved : item)); };
  return <div className="p-4 md:p-8 max-w-6xl mx-auto"><PageHeader title="Follow-ups" subtitle="Turn completed work into repeat business" /><div className="flex justify-end mb-4"><Button onClick={async () => { await seedDefaultFollowUpRules(user); load(); }} className="bg-titan-cyan text-black">Seed defaults</Button></div><div className="grid lg:grid-cols-2 gap-5"><section className="glass rounded-2xl p-5"><h2 className="font-semibold text-white mb-3">Automation rules</h2>{rules.map((rule) => <div key={rule.id} className="py-3 border-b border-white/5 text-sm"><span className="text-white">{rule.name}</span><span className="float-right text-titan-cyan">{rule.delay_days} days</span><p className="text-xs text-white/40 mt-1">{rule.message_template}</p></div>)}<form onSubmit={add} className="flex gap-2 mt-4"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" className="bg-white/5 border-white/10 text-white" /><Input value={days} onChange={(e) => setDays(e.target.value)} type="number" className="w-20 bg-white/5 border-white/10 text-white" /><Button>Add</Button></form></section><section className="glass rounded-2xl p-5"><h2 className="font-semibold text-white mb-3">Pending queue</h2>{queue.filter((row) => row.status === "pending").map((row) => <div key={row.id} className="border-b border-white/5 py-3 flex gap-3"><Send className="w-4 h-4 text-titan-cyan mt-1" /><div className="flex-1"><p className="text-sm text-white">{row.customer_name || "Customer"}</p><p className="text-xs text-white/40">{row.message}</p><p className="text-xs text-white/25 mt-1">{new Date(row.scheduled_for).toLocaleDateString()}</p></div><Button onClick={() => sent(row)} size="sm" variant="outline" className="border-white/10 text-white"><Check className="w-4 h-4" />Sent</Button></div>)}{!queue.some((row) => row.status === "pending") && <p className="text-white/35 text-sm py-8">No pending follow-ups.</p>}</section></div></div>;
}
