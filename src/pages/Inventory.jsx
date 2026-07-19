import React, { useEffect, useState } from "react";
import { AlertTriangle, PackagePlus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import { createInventoryItem, isLowStock, listInventory, updateInventoryItem } from "@/lib/inventoryApi";
const EMPTY = { name: "", quantity: "", reorder_at: "5", unit: "ea", category: "supplies", unit_cost: "" };
export default function Inventory() {
  const { user } = useAuth(); const [items, setItems] = useState([]); const [form, setForm] = useState(EMPTY);
  const load = async () => { if (user?.id) setItems(await listInventory(user.id)); }; useEffect(() => { load(); }, [user?.id]);
  const add = async (e) => { e.preventDefault(); if (!form.name) return; const item = await createInventoryItem(user, form); setItems([item, ...items]); setForm(EMPTY); };
  const adjust = async (item, quantity) => { const saved = await updateInventoryItem(user.id, item.id, { quantity }); setItems(items.map((row) => row.id === item.id ? saved : row)); };
  const low = items.filter(isLowStock);
  return <div className="p-4 md:p-8 max-w-6xl mx-auto"><PageHeader title="Inventory" subtitle={`${low.length} low-stock alert${low.length === 1 ? "" : "s"}`} /><div className="grid lg:grid-cols-[.75fr_1.25fr] gap-5"><form className="glass rounded-2xl p-5 space-y-3" onSubmit={add}><h2 className="font-semibold text-foreground flex gap-2"><PackagePlus className="text-titan-cyan" />Add item</h2>{["name","quantity","reorder_at","unit_cost"].map((key) => <Input key={key} required={key === "name"} type={key === "name" ? "text" : "number"} placeholder={key.replace("_", " ")} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="bg-muted border-border text-foreground" />)}<Button className="bg-titan-cyan text-black w-full">Save item</Button></form><section className="space-y-3">{items.map((item) => <article className="glass rounded-2xl p-4 flex justify-between gap-3" key={item.id}><div><p className="font-semibold text-foreground">{item.name}</p><p className="text-sm text-foreground/45">{item.category} · ${Number(item.unit_cost || 0).toFixed(2)}/{item.unit || "ea"}</p>{isLowStock(item) && <p className="text-xs text-titan-amber flex gap-1 mt-1"><AlertTriangle className="w-3 h-3" />Reorder now</p>}</div><div className="flex items-center gap-2"><Button size="sm" onClick={() => adjust(item, Number(item.quantity) - 1)}>-</Button><span className="text-foreground">{item.quantity}</span><Button size="sm" onClick={() => adjust(item, Number(item.quantity) + 1)}>+</Button></div></article>)}</section></div></div>;
}
