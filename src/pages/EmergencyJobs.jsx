import React, { useEffect, useState } from "react";
import { Siren, Plus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import {
  createEmergencyJob,
  listEmergencyJobs,
  updateEmergencyJob,
} from "@/lib/emergencyJobsApi";

export default function EmergencyJobs() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ title: "", city: "", budget: "", notes: "" });

  const load = async () => {
    if (user?.id) setRows(await listEmergencyJobs(user.id));
  };
  useEffect(() => {
    load();
  }, [user?.id]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const row = await createEmergencyJob(user, {
      title: form.title.trim(),
      city: form.city,
      budget: Number(form.budget || 0),
      notes: form.notes,
      urgency: "same_day",
      contact_name: user.full_name || "",
      contact_phone: user.phone || "",
    });
    setRows([row, ...rows]);
    setForm({ title: "", city: "", budget: "", notes: "" });
  };

  const claim = async (row) => {
    const saved = await updateEmergencyJob(user.id, row.id, { status: "claimed" });
    setRows(rows.map((r) => (r.id === row.id ? saved : r)));
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28">
      <PageHeader title="Emergency Jobs" subtitle="Same-day / ASAP work alerts for busy crews" />
      <form onSubmit={add} className="glass rounded-2xl p-5 mb-5 space-y-3">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Siren className="w-5 h-5" /> Post an urgent need
        </div>
        <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs done today?" className="bg-muted border-border text-foreground" />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="bg-muted border-border text-foreground" />
          <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="Budget ($)" className="bg-muted border-border text-foreground" />
        </div>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Details" rows={2} className="bg-muted border-border text-foreground" />
        <Button type="submit"><Plus className="w-4 h-4" /> Post same-day job</Button>
      </form>
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold text-foreground">{row.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {row.urgency?.replace("_", " ")} · {row.city || "Local"} · ${Number(row.budget || 0).toLocaleString()}
              </p>
              {row.notes && <p className="text-sm text-muted-foreground mt-2">{row.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs capitalize text-primary">{row.status}</span>
              {row.status === "open" && (
                <Button size="sm" onClick={() => claim(row)}>Mark claimed</Button>
              )}
            </div>
          </article>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">No emergency posts yet.</p>}
      </div>
    </div>
  );
}
