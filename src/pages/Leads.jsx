import React, { useState } from "react";
import { Plus, Trash2, UserRound, Upload } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { createLead, deleteLead, listLeads, updateStatus } from "@/lib/leadsApi";
import { importLeadsFromCsv } from "@/lib/leadImportApi";

const STATUSES = ["new", "called", "emailed", "interested", "scheduled"];

export default function Leads() {
  const { user } = useAuth();
  const { data: rows = [], setData: setRows, loading, error, reload } = useSafeAsync(
    () => listLeads(user.id),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("all");
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (!name) return;
    const row = await createLead(user, { name });
    setRows([row, ...rows]);
    setName("");
  };

  const move = async (row, status) => {
    const saved = await updateStatus(user.id, row.id, status);
    setRows(rows.map((lead) => (lead.id === row.id ? saved : lead)));
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete lead “${row.name}”?`)) return;
    try {
      await deleteLead(user.id, row.id);
      setRows((prev) => prev.filter((lead) => lead.id !== row.id));
      toast({ title: "Lead deleted" });
    } catch {
      toast({ title: "Couldn't delete lead", variant: "destructive" });
    }
  };

  const importCsv = async () => {
    if (!csvText.trim() || importing) return;
    setImporting(true);
    try {
      const result = await importLeadsFromCsv(user, csvText);
      toast({ title: `Imported ${result.count} leads` });
      setCsvText("");
      reload();
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading leads" />;
  if (error) return <ErrorState title="Couldn't load leads" onRetry={reload} />;

  const display = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return (
    <div className="page-pad max-w-6xl mx-auto">
      <PageHeader title="Leads" subtitle="Find, qualify, and convert new work" />
      <form onSubmit={add} className="glass rounded-2xl p-4 flex gap-2 mb-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead name" className="bg-muted border-border text-foreground" />
        <Button><Plus className="w-4 h-4" />Add lead</Button>
      </form>

      <section className="glass rounded-2xl p-4 mb-4 space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Upload className="w-4 h-4 text-titan-cyan" /> CSV import</p>
        <p className="text-xs text-muted-foreground">Columns: name, email, phone, notes (header optional)</p>
        <Textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={3} placeholder={"name,email,phone\nJane Doe,jane@email.com,555-0100"} className="bg-muted border-border text-foreground font-mono text-xs" />
        <Button onClick={importCsv} disabled={importing || !csvText.trim()} variant="outline" className="border-border text-foreground">
          {importing ? "Importing…" : "Import leads"}
        </Button>
      </section>

      <div className="flex gap-2 overflow-auto mb-4">
        {["all", ...STATUSES].map((status) => (
          <Button key={status} onClick={() => setFilter(status)} variant="outline" className={filter === status ? "border-titan-cyan text-titan-cyan" : "border-border text-muted-foreground"}>
            {status}
          </Button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {display.map((row) => (
          <article key={row.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <UserRound className="w-5 h-5 text-titan-cyan" />
              <button
                type="button"
                onClick={() => remove(row)}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                aria-label={`Delete ${row.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="font-semibold text-foreground">{row.name}</p>
            <p className="text-xs text-muted-foreground my-2">{row.phone || row.email || row.source || "New inquiry"}</p>
            <select value={row.status} onChange={(e) => move(row, e.target.value)} className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </article>
        ))}
      </div>
    </div>
  );
}
