import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
const key = "titanos-career-applications-v1";
const statuses = ["Saved", "Applied", "Interview", "Offer", "Rejected", "Closed"];
function read() {
  try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
export default function ApplicationTracker() {
  const [items, setItems] = useState(read);
  const [draft, setDraft] = useState({ company: "", position: "", url: "", notes: "" });
  const [status, setStatus] = useState("Saved");
  const [saveNotice, setSaveNotice] = useState("");
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(items)); setSaveNotice("Saved on this device"); }
    catch { setSaveNotice("Storage is unavailable; export your information separately."); }
  }, [items]);
  function add(event) {
    event.preventDefault();
    if (!draft.company.trim() || !draft.position.trim()) return;
    setItems(all => [{ id: globalThis.crypto?.randomUUID?.() || String(Date.now()), ...draft, company: draft.company.trim(), position: draft.position.trim(), status, createdAt: new Date().toISOString() }, ...all]);
    setDraft({ company: "", position: "", url: "", notes: "" }); setStatus("Saved");
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
    <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{saveNotice}</p>
    {!items.length && <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">No saved opportunities yet. Add a job you're considering or have applied for.</p>}
    <ul className="space-y-3">{items.map(item=><li key={item.id} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.position}</h3><p className="text-sm text-muted-foreground">{item.company}</p></div><button type="button" onClick={()=>{if(window.confirm("Delete this entry?"))setItems(all=>all.filter(i=>i.id!==item.id));}} aria-label={`Delete ${item.position} at ${item.company}`} className="min-h-11 min-w-11 text-destructive"><Trash2 size={18}/></button></div>
      <label className="mt-3 block text-sm">Application stage <select value={item.status} onChange={e=>setItems(all=>all.map(i=>i.id===item.id?{...i,status:e.target.value}:i))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3">{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
      {item.url?.startsWith("https://") && <a target="_blank" rel="noopener noreferrer" href={item.url} className="mt-2 inline-block text-sm text-primary underline">View job listing</a>}
      {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>}
    </li>)}</ul>
  </section>;
}
