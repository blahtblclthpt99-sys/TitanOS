import React, { useState } from "react";
import { AlertTriangle, Archive, FileText, Pencil, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import DeleteButton from "@/components/shared/DeleteButton";
import FormField from "@/components/shared/FormField";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import {
  createCredential,
  credentialStatus,
  deleteCredential,
  listCredentials,
  renewCredential,
  updateCredential,
} from "@/lib/credentialsApi";

const EMPTY = {
  title: "", number: "", state: "", issued_on: "", expires_on: "",
  document_url: "", notes: "", reminder_days: 30,
};

const STATUS_STYLE = {
  current: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  soon: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  expired: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  archived: "border-border bg-muted text-muted-foreground",
};

function statusDetail(status) {
  if (status.days === null) return "No expiration date";
  if (status.days < 0) return `Expired ${Math.abs(status.days)} days ago`;
  if (status.days === 0) return "Expires today";
  return `${status.days} days remaining`;
}

export default function Credentials() {
  const { user } = useAuth();
  const { data: items = [], setData: setItems, loading, error, reload } = useSafeAsync(
    () => listCredentials(user.id), [user?.id], { enabled: Boolean(user?.id), initial: [] }
  );
  const [form, setForm] = useState(EMPTY);
  const [mode, setMode] = useState("create");
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reset = () => { setForm(EMPTY); setMode("create"); setActive(null); };
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const start = (nextMode, item) => {
    setMode(nextMode);
    setActive(item);
    setForm({
      ...EMPTY, ...item,
      issued_on: item?.issued_on || "",
      expires_on: nextMode === "renew" ? "" : item?.expires_on || "",
      document_url: nextMode === "renew" ? "" : item?.document_url || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      patch("document_url", file_url);
      toast({ title: "Document attached" });
    } catch (uploadError) {
      toast({ variant: "destructive", title: "Upload failed", description: uploadError?.message });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || saving) return;
    if (form.issued_on && form.expires_on && form.expires_on < form.issued_on) {
      toast({ variant: "destructive", title: "Expiration must be after the issue date" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim(), reminder_days: Number(form.reminder_days || 30) };
      let saved;
      if (mode === "renew") saved = await renewCredential(user, active, payload);
      else if (mode === "edit") saved = await updateCredential(user.id, active.id, payload);
      else saved = await createCredential(user, payload);
      setItems((current) => mode === "create"
        ? [saved, ...current]
        : current.map((row) => row.id === active.id ? saved : row));
      toast({ title: mode === "renew" ? "Credential renewed" : mode === "edit" ? "Credential updated" : "Credential added" });
      reset();
      reload();
    } catch (saveError) {
      toast({ variant: "destructive", title: "Could not save credential", description: saveError?.message || "Please try again." });
    } finally { setSaving(false); }
  };

  if (loading) return <PageLoader variant="list" label="Loading credentials" />;
  if (error) return <ErrorState title="Could not load credentials" onRetry={reload} />;

  const visible = items.filter((item) => item.status !== "archived");
  const archived = items.filter((item) => item.status === "archived");

  return (
    <div className="page-pad max-w-6xl mx-auto space-y-5">
      <PageHeader title="Licenses & certifications" subtitle="Documents, renewal dates, and reminders in one place" />
      <form onSubmit={save} className="titan-surface p-4 sm:p-5 space-y-4" aria-label="Credential editor">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">{mode === "renew" ? "Renew credential" : mode === "edit" ? "Edit credential" : "Add credential"}</h2>
          <p className="text-xs text-muted-foreground">Required fields are marked with an asterisk.</p></div>
          {active && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FormField label="Name" required><Input required value={form.title} onChange={(e) => patch("title", e.target.value)} placeholder="HVAC contractor license" /></FormField>
          <FormField label="Number"><Input value={form.number} onChange={(e) => patch("number", e.target.value)} placeholder="License number" autoComplete="off" /></FormField>
          <FormField label="State"><Input value={form.state} onChange={(e) => patch("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" autoCapitalize="characters" /></FormField>
          <FormField label="Issue date"><Input type="date" value={form.issued_on} onChange={(e) => patch("issued_on", e.target.value)} /></FormField>
          <FormField label="Expiration date"><Input type="date" value={form.expires_on} onChange={(e) => patch("expires_on", e.target.value)} /></FormField>
          <FormField label="Reminder"><select className="flex h-11 w-full rounded-md border border-border bg-background px-3" value={form.reminder_days} onChange={(e) => patch("reminder_days", e.target.value)}><option value="7">7 days before</option><option value="14">14 days before</option><option value="30">30 days before</option><option value="60">60 days before</option><option value="90">90 days before</option></select></FormField>
        </div>
        <FormField label="Notes"><Textarea value={form.notes} onChange={(e) => patch("notes", e.target.value)} placeholder="Renewal requirements or contact information" rows={2} /></FormField>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">
            <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : form.document_url ? "Replace attachment" : "Attach document"}
            <input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={upload} disabled={uploading} />
          </label>
          {form.document_url && <a className="text-sm text-primary underline" href={form.document_url} target="_blank" rel="noreferrer">View attachment</a>}
          <Button className="sm:ml-auto" disabled={saving || uploading || !form.title.trim()}>{saving ? "Saving…" : mode === "renew" ? "Complete renewal" : "Save credential"}</Button>
        </div>
      </form>

      {!visible.length && <EmptyState icon={ShieldCheck} title="No credentials yet" description="Add a license or certification to track its status and renewal date." />}
      <div className="grid md:grid-cols-2 gap-4">
        {visible.map((item) => {
          const status = credentialStatus(item);
          const Icon = status.id === "current" ? ShieldCheck : AlertTriangle;
          return <article className="titan-surface p-4 space-y-4" key={item.id}>
            <div className="flex gap-3"><Icon className="w-5 h-5 mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><h3 className="font-semibold truncate">{item.title}</h3><p className="text-sm text-muted-foreground">{[item.number, item.state].filter(Boolean).join(" · ") || "No number recorded"}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status.id]}`}>{status.label}</span></div>
            <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Issue date</p><p>{item.issued_on || "Not recorded"}</p></div><div><p className="text-xs text-muted-foreground">Expiration</p><p>{item.expires_on || "Not recorded"}</p></div></div>
            <p className="text-sm font-medium">{statusDetail(status)}</p>
            {item.notes && <p className="text-sm text-muted-foreground line-clamp-2">{item.notes}</p>}
            <div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => start("renew", item)}><RefreshCw className="w-4 h-4 mr-1" /> Renew</Button><Button type="button" size="sm" variant="outline" onClick={() => start("edit", item)}><Pencil className="w-4 h-4 mr-1" /> Edit</Button>{item.document_url && <Button asChild size="sm" variant="ghost"><a href={item.document_url} target="_blank" rel="noreferrer"><FileText className="w-4 h-4 mr-1" /> Document</a></Button>}<DeleteButton label={item.title} onDelete={async () => { await deleteCredential(user.id, item.id); setItems((rows) => rows.filter((row) => row.id !== item.id)); }} /></div>
          </article>;
        })}
      </div>
      {archived.length > 0 && <details className="titan-surface p-4"><summary className="cursor-pointer font-semibold flex items-center gap-2"><Archive className="w-4 h-4" /> Renewal archive ({archived.length})</summary><div className="mt-3 divide-y divide-border">{archived.map((item) => <div key={item.id} className="py-3 text-sm"><p className="font-medium">{item.title}</p><p className="text-muted-foreground">Expired {item.expires_on || "date not recorded"} · {item.number || "No number"}</p></div>)}</div></details>}
    </div>
  );
}
