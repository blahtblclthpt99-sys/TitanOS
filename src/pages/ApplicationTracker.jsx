import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";
const key = "titanos-career-applications-v1";
const statuses = ["Saved", "Applied", "Interview", "Offer", "Rejected", "Closed"];
function read() {
  try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
export default function ApplicationTracker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState(read);
  const [draft, setDraft] = useState(() => ({
    company: (searchParams.get("company") || "").slice(0, 150),
    position: (searchParams.get("position") || "").slice(0, 150),
    url: (searchParams.get("url") || "").startsWith("https://") ? (searchParams.get("url") || "").slice(0, 2000) : "",
    notes: "",
  }));
  // HashRouter may reuse this mounted page when users choose another job match.
  // Refresh the form whenever the incoming job changes.
  useEffect(() => {
    if (!searchParams.has("position") && !searchParams.has("company")) return;
    const nextUrl = searchParams.get("url") || "";
    setDraft({
      company: (searchParams.get("company") || "").slice(0, 150),
      position: (searchParams.get("position") || "").slice(0, 150),
      url: nextUrl.startsWith("https://") ? nextUrl.slice(0, 2000) : "",
      notes: "",
    });
  }, [searchParams]);
  const [status, setStatus] = useState("Saved");
  const [saveNotice, setSaveNotice] = useState("");
  const importInput = useRef(null);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(items)); setSaveNotice("Saved on this device"); }
    catch { setSaveNotice("Storage is unavailable; export your information separately."); }
  }, [items]);
  function exportRecords() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), applications: items }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "TitanOS-Applications-Backup.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function importRecords(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setSaveNotice("Backup too large (2 MB maximum)."); return; }
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.version !== 1 || !Array.isArray(parsed.applications) || parsed.applications.length > 1000) {
        throw new Error("Invalid TitanOS applications backup.");
      }
      const valid = parsed.applications.every((item) =>
        item && typeof item.id === "string" && typeof item.company === "string" &&
        typeof item.position === "string" && statuses.includes(item.status) &&
        (!item.url || (typeof item.url === "string" && item.url.startsWith("https://"))) &&
        (!item.notes || typeof item.notes === "string")
      );
      if (!valid) throw new Error("Backup contains invalid application records.");
      if (!window.confirm(`Restore ${parsed.applications.length} applications? This replaces the current tracker. Export a backup first.`)) return;
      setItems(parsed.applications.map(item => ({
        id: item.id.slice(0, 150), company: item.company.slice(0, 150),
        position: item.position.slice(0, 150), status: item.status,
        url: (item.url || "").slice(0, 2000), notes: (item.notes || "").slice(0, 5000),
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      })));
      setSaveNotice("Backup restored on this device.");
    } catch {
      setSaveNotice("Could not import that TitanOS applications backup. No existing records were changed.");
    }
  }
  function add(event) {
    event.preventDefault();
    if (!draft.company.trim() || !draft.position.trim()) return;
    const canonicalUrl = draft.url.trim();
    if (canonicalUrl && !/^https:\/\//i.test(canonicalUrl)) {
      setSaveNotice("Job link must start with https://");
      return;
    }
    setItems(all => [{ id: globalThis.crypto?.randomUUID?.() || String(Date.now()), ...draft, url: canonicalUrl, company: draft.company.trim(), position: draft.position.trim(), status, createdAt: new Date().toISOString() }, ...all]);
    setDraft({ company: "", position: "", url: "", notes: "" }); setStatus("Saved");
    if (searchParams.has("position") || searchParams.has("company") || searchParams.has("url")) setSearchParams({}, { replace: true });
  }
  return <section className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
    <Link to="/career" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"><ArrowLeft size={17}/> Back to careers</Link>
    <header><h1 className="text-2xl font-bold">Application Tracker</h1><p className="mt-1 text-sm text-muted-foreground">Keep track of opportunities manually. Records stay on this device and do not submit applications.</p></header>
    <form onSubmit={add} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">Add opportunity</h2>
      {[["company","Company"],["position","Position"],["url","Job link (optional)"]].map(([field,label])=><label key={field} className="block text-sm"><span className="font-medium">{label}</span><input required={field!=="url"} type={field==="url"?"url":"text"} value={draft[field]} onChange={e=>setDraft(d=>({...d,[field]:e.target.value}))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"/></label>)}
      <label className="block text-sm"><span className="font-medium">Stage</span><select value={status} onChange={e=>setStatus(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3">{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="block text-sm"><span className="font-medium">Notes</span><textarea value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background p-3"/></label>
      <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"><Plus size={18}/> Add opportunity</button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{saveNotice}</p>
      <input ref={importInput} type="file" accept=".json,application/json" onChange={importRecords} className="sr-only" aria-label="Choose applications backup file" />
      <button type="button" onClick={() => importInput.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground">Import backup</button>
      <button type="button" onClick={exportRecords} disabled={!items.length} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground disabled:opacity-50"><Download size={17}/> Export backup</button>
    </div>
    {!items.length && <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">No saved opportunities yet. Add a job you're considering or have applied for.</p>}
    <ul className="space-y-3">{items.map(item=><li key={item.id} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.position}</h3><p className="text-sm text-muted-foreground">{item.company}</p></div><button type="button" onClick={()=>{if(window.confirm("Delete this entry?"))setItems(all=>all.filter(i=>i.id!==item.id));}} aria-label={`Delete ${item.position} at ${item.company}`} className="min-h-11 min-w-11 text-destructive"><Trash2 size={18}/></button></div>
      <label className="mt-3 block text-sm">Application stage <select value={item.status} onChange={e=>setItems(all=>all.map(i=>i.id===item.id?{...i,status:e.target.value}:i))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3">{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
      {item.url?.startsWith("https://") && <a target="_blank" rel="noopener noreferrer" href={item.url} className="mt-2 inline-block text-sm text-primary underline">View job listing</a>}
      {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>}
    </li>)}</ul>
  </section>;
}
