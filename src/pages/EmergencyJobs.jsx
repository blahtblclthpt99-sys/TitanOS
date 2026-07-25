import React, { useEffect, useState } from "react";
import { Siren, Plus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import {
  createEmergencyJob,
  deleteEmergencyJob,
  listEmergencyJobs,
  updateEmergencyJob,
} from "@/lib/emergencyJobsApi";
import DeleteButton from "@/components/shared/DeleteButton";

export default function EmergencyJobs() {
  const { user, authChecked } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ title: "", city: "", budget: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      setRows(await listEmergencyJobs(user.id));
    } catch {
      toast({ variant: "destructive", title: "Couldn't load emergency board" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!authChecked) return;
    if (!user?.id) { setLoading(false); return; }
    load();
  }, [authChecked, user?.id]);

  const add = async (e) => {
    e.preventDefault();
    if (saving || !form.title.trim()) return;
    setSaving(true);
    try {
      const row = await createEmergencyJob(user, {
        title: form.title.trim(),
        city: form.city,
        budget: Number(form.budget || 0),
        notes: form.notes,
        urgency: "same_day",
        contact_name: user.full_name || "",
        contact_phone: user.phone || "",
      });
      setRows((current) => [row, ...current]);
      setForm({ title: "", city: "", budget: "", notes: "" });
      toast({ title: "Job posted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't post job", description: error?.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const claim = async (row) => {
    try {
      const saved = await updateEmergencyJob(user.id, row.id, { status: "claimed" });
      setRows((current) => current.map((r) => (r.id === row.id ? saved : r)));
      toast({ title: "Marked claimed" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't update job" });
    }
  };

  if (!authChecked || loading) return <PageLoader variant="list" label="Loading emergency board" />;
  if (!user?.id) {
    return (
      <PageShell maxWidth="lg">
        <PageHeader
          eyebrow="Labs · Coming soon"
          title="Emergency board"
          subtitle="Your personal same-day list — not a live network alerting nearby crews."
        />
        <EmptyState
          title="Sign in to use the emergency board"
          description="Posting and claiming same-day jobs requires an account."
          actionLabel="Sign in"
          onAction={() => { window.location.href = "/login"; }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Labs · Coming soon"
        title="Emergency board"
        subtitle="Your personal same-day list — not a live network alerting nearby crews."
      />
      <FeatureHonestyBanner>
        Posts stay on your account (or this device if sync fails). TitanOS does not broadcast urgent jobs
        to other users or dispatch responders. Treat this as a personal checklist until a dispatch network
        ships.
      </FeatureHonestyBanner>
      <form onSubmit={add} className="titan-surface mb-5 space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Siren className="h-5 w-5" aria-hidden="true" /> Post an urgent need
        </div>
        <Input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What needs done today?"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="City"
          />
          <Input
            type="number"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            placeholder="Budget ($)"
          />
        </div>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Details"
          rows={2}
        />
        <Button type="submit" disabled={saving}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {saving ? "Posting…" : "Post same-day job"}
        </Button>
      </form>
      <div className="space-y-3">
        {!rows.length && (
          <EmptyState
            icon={Siren}
            title="No emergency posts yet"
            description="Post an urgent need above to track it here."
          />
        )}
        {rows.map((row) => (
          <article key={row.id} className="titan-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-semibold text-foreground">{row.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.urgency?.replace("_", " ")} · {row.city || "Local"} · $
                {Number(row.budget || 0).toLocaleString()}
              </p>
              {row.notes && <p className="mt-2 text-sm text-muted-foreground">{row.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs capitalize text-primary">{row.status}</span>
              {row.status === "open" && (
                <Button size="sm" onClick={() => claim(row)}>
                  Mark claimed
                </Button>
              )}
              <DeleteButton
                label={row.title}
                onDelete={async () => {
                  try {
                    await deleteEmergencyJob(user.id, row.id);
                    setRows((prev) => prev.filter((r) => r.id !== row.id));
                    toast({ title: "Post deleted" });
                  } catch {
                    toast({ variant: "destructive", title: "Couldn't delete post" });
                  }
                }}
              />
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
