import React, { useEffect, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import { createLead, listLeads, updateStatus } from "@/lib/leadsApi";
const STATUSES = ["new", "called", "emailed", "interested", "scheduled"];
export default function Leads() {
  const { user } = useAuth(); const [rows, setRows] = useState([]); const [name, setName] = useState(""); const [filter, setFilter] = useState("all");
  const load = async () => { if (user?.id) setRows(await listLeads(user.id)); }; useEffect(() => { load(); }, [user?.id]);
  const add = async (e) => { e.preventDefault(); if (!name) return; const row = await createLead(user, { name }); setRows([row, ...rows]); setName(""); };
  const move = async (row, status) => { const saved = await updateStatus(user.id, row.id, status); setRows(rows.map((lead) => lead.id === row.id ? saved : lead)); };
  const display = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  return <div className="p-4 md:p-8 max-w-6xl mx-auto"><PageHeader title="Leads" subtitle="Find, qualify, and convert new work" /><form onSubmit={add} className="glass rounded-2xl p-4 flex gap-2 mb-4"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead name" className="bg-white/5 border-white/10 text-white" /><Button className="bg-titan-cyan text-black"><Plus className="w-4 h-4" />Add lead</Button></form><div className="flex gap-2 overflow-auto mb-4">{["all", ...STATUSES].map((status) => <Button key={status} onClick={() => setFilter(status)} variant="outline" className={filter === status ? "border-titan-cyan text-titan-cyan" : "border-white/10 text-white/55"}>{status}</Button>)}</div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{display.map((row) => <article key={row.id} className="glass rounded-2xl p-4"><UserRound className="w-5 h-5 text-titan-cyan mb-3" /><p className="font-semibold text-white">{row.name}</p><p className="text-xs text-white/40 my-2">{row.phone || row.email || "New inquiry"}</p><select value={row.status} onChange={(e) => move(row, e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></article>)}</div></div>;
}
