import React, { useRef, useState } from "react";
import { FileCheck2, FileText, Plus, Trash2, Upload, UserRound, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import ExportMenu from "@/components/shared/ExportMenu";
import { leadsExportSpec } from "@/lib/export";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { createLead, deleteLead, listLeads, updateStatus } from "@/lib/leadsApi";
import { importLeadRows, parseLeadFile } from "@/lib/leadImportApi";

const STATUSES = ["new", "called", "emailed", "interested", "scheduled"];

export default function Leads() {
  const { user } = useAuth();
  const { data: rows = [], setData: setRows, loading, error, reload } = useSafeAsync(
    () => listLeads(user.id), [user?.id], { enabled: Boolean(user?.id), initial: [] }
  );
  const fileInputRef = useRef(null);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [fileError, setFileError] = useState("");
  const [readingFile, setReadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const add = async (event) => {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      const row = await createLead(user, { name: name.trim() });
      setRows((current) => [row, ...current]);
      setName("");
      toast({ title: "Lead added" });
    } catch (addError) {
      toast({ variant: "destructive", title: "Couldn't add lead", description: addError?.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const move = async (row, status) => {
    try {
      const saved = await updateStatus(user.id, row.id, status);
      setRows((current) => current.map((lead) => (lead.id === row.id ? saved : lead)));
      toast({ title: `Lead moved to ${status}` });
    } catch {
      toast({ variant: "destructive", title: "Couldn't update lead" });
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete lead “${row.name}”?`)) return;
    try {
      await deleteLead(user.id, row.id);
      setRows((current) => current.filter((lead) => lead.id !== row.id));
      toast({ title: "Lead deleted" });
    } catch {
      toast({ title: "Couldn't delete lead", variant: "destructive" });
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewRows([]);
    setFileError("");
  };

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setReadingFile(true);
    setFileError("");
    setSelectedFile(file);
    try {
      const parsed = await parseLeadFile(file);
      setPreviewRows(parsed);
      if (!parsed.length) setFileError("No valid email addresses were found in this file.");
    } catch (readError) {
      setPreviewRows([]);
      setFileError(readError?.message || "This file could not be read.");
    } finally {
      setReadingFile(false);
    }
  };

  const importFile = async () => {
    if (!previewRows.length || importing) return;
    setImporting(true);
    try {
      const result = await importLeadRows(user, previewRows, rows);
      toast({ title: `Imported ${result.count} leads`, description: result.skipped ? `${result.skipped} duplicate${result.skipped === 1 ? " was" : "s were"} skipped.` : undefined });
      clearFile();
      reload();
    } catch (importError) {
      toast({ title: "Import failed", description: importError?.message || "Please try again.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading leads" />;
  if (error) return <ErrorState title="Couldn't load leads" onRetry={reload} />;
  const display = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return (
    <div className="page-pad max-w-6xl mx-auto">
      <PageHeader title="Leads" subtitle="Find, qualify, and convert new work" actions={(
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} className="min-h-[44px]"><Upload className="w-4 h-4" /> Upload leads</Button>
          <ExportMenu spec={leadsExportSpec(display)} size="sm" />
        </div>
      )} />
      <input ref={fileInputRef} type="file" accept=".pdf,.csv,.txt,text/csv,text/plain,application/pdf" onChange={chooseFile} className="sr-only" aria-label="Upload lead file" />

      <form onSubmit={add} className="titan-surface p-4 flex flex-col sm:flex-row gap-2 mb-4">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Lead name" className="bg-muted border-border text-foreground min-h-[44px]" />
        <Button disabled={saving} className="min-h-[44px]"><Plus className="w-4 h-4" />{saving ? "Adding…" : "Add lead"}</Button>
      </form>

      <section className="titan-surface p-4 mb-4">
        {!selectedFile ? (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full min-h-28 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-5 text-center transition-colors hover:bg-primary/10 focus-ring">
            <Upload className="mx-auto mb-2 h-6 w-6 text-titan-cyan" />
            <span className="block text-sm font-semibold text-foreground">Upload a lead file</span>
            <span className="mt-1 block text-xs text-muted-foreground">PDF, CSV, or TXT · email addresses are detected automatically</span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5"><FileText className="h-5 w-5 text-primary" /></div>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{selectedFile.name}</p><p className="text-xs text-muted-foreground">{readingFile ? "Reading file…" : `${previewRows.length} valid email${previewRows.length === 1 ? "" : "s"} ready`}</p></div>
              </div>
              <button type="button" onClick={clearFile} className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove uploaded file"><X className="h-5 w-5" /></button>
            </div>
            {fileError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{fileError}</p>}
            {!!previewRows.length && <div className="max-h-44 overflow-auto rounded-xl border border-border bg-muted/30">{previewRows.slice(0, 50).map((lead) => <div key={lead.email} className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 last:border-0"><FileCheck2 className="h-4 w-4 shrink-0 text-emerald-400" /><span className="truncate text-sm text-foreground">{lead.email}</span></div>)}</div>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="min-h-[44px]">Choose another</Button>
              <Button type="button" onClick={importFile} disabled={readingFile || importing || !previewRows.length} className="min-h-[44px]">{importing ? "Importing…" : `Import ${previewRows.length || ""} lead${previewRows.length === 1 ? "" : "s"}`}</Button>
            </div>
          </div>
        )}
      </section>

      <div className="flex gap-2 overflow-auto mb-4 pb-1" role="tablist" aria-label="Lead status filter">
        {["all", ...STATUSES].map((status) => <button key={status} type="button" role="tab" aria-selected={filter === status} onClick={() => setFilter(status)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold capitalize transition-colors focus-ring min-h-[44px] ${filter === status ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"}`}>{status}</button>)}
      </div>
      {!display.length && <EmptyState icon={UserRound} title={filter === "all" ? "No leads yet" : "No matches"} description={filter === "all" ? "Add one lead above or upload a PDF, CSV, or TXT file." : "No leads match this status filter."} />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {display.map((row) => <article key={row.id} className="titan-surface p-4">
          <div className="flex items-start justify-between gap-2 mb-3"><UserRound className="w-5 h-5 text-titan-cyan" /><button type="button" onClick={() => remove(row)} className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]" aria-label={`Delete ${row.name}`}><Trash2 className="w-4 h-4" /></button></div>
          <p className="font-semibold text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground my-2">{row.email || row.phone || row.source || "New inquiry"}</p>
          <select value={row.status} onChange={(event) => move(row, event.target.value)} className="w-full min-h-[44px] bg-muted border border-border rounded-lg p-2 text-sm text-foreground">{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
        </article>)}
      </div>
    </div>
  );
}
