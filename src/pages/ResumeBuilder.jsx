import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Download, FileText, Plus, Printer, Sparkles, Trash2 } from "lucide-react";

const newId = () => globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyExperience = () => ({ id: newId(), employer: "", title: "", location: "", start: "", end: "", details: "" });
const emptyEducation = () => ({ id: newId(), school: "", credential: "", year: "" });
const initial = () => ({
  fullName: "", email: "", phone: "", location: "", headline: "", summary: "", skills: "",
  experience: [emptyExperience()], education: [emptyEducation()], certifications: "", template: "modern",
});
const TEXT_FIELDS = ["fullName", "email", "phone", "location", "headline", "summary", "skills", "certifications"];
function textOnly(value) { return typeof value === "string" ? value.slice(0, 12000) : ""; }
function normalizeResume(data) {
  const defaults = initial();
  if (!data || typeof data !== "object" || Array.isArray(data)) return defaults;
  const next = { ...defaults };
  for (const key of TEXT_FIELDS) next[key] = textOnly(data[key]);
  next.template = data.template === "classic" ? "classic" : "modern";
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const education = Array.isArray(data.education) ? data.education : [];
  next.experience = experience.slice(0, 40).filter((x) => x && typeof x === "object" && !Array.isArray(x)).map((x) => ({
    id: typeof x.id === "string" && x.id.length < 120 ? x.id : newId(),
    employer: textOnly(x.employer), title: textOnly(x.title), location: textOnly(x.location),
    start: textOnly(x.start), end: textOnly(x.end), details: textOnly(x.details),
  }));
  next.education = education.slice(0, 30).filter((x) => x && typeof x === "object" && !Array.isArray(x)).map((x) => ({
    id: typeof x.id === "string" && x.id.length < 120 ? x.id : newId(),
    school: textOnly(x.school), credential: textOnly(x.credential), year: textOnly(x.year),
  }));
  return next;
}
function readResume(userId) {
  if (!userId) return initial();
  try {
    const raw = localStorage.getItem(`titanos:resume:v1:${userId}`);
    if (!raw) return initial();
    return normalizeResume(JSON.parse(raw));
  } catch {
    return initial();
  }
}
function itemLines(text) {
  return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function buildPlainText(draft) {
  const out = [
    draft.fullName.trim().toUpperCase(),
    [draft.location, draft.phone, draft.email].filter(Boolean).join(" | "),
    draft.headline, "",
    "PROFESSIONAL SUMMARY", draft.summary, "",
    "CORE SKILLS", draft.skills, "",
    "WORK EXPERIENCE",
  ];
  for (const item of draft.experience) {
    if (![item.title, item.employer, item.details].some((field) => String(field || "").trim())) continue;
    out.push([item.title, item.employer].filter(Boolean).join(" — "), [item.location, [item.start, item.end || "Present"].filter(Boolean).join(" – ")].filter(Boolean).join(" | "), ...itemLines(item.details).map((line) => `• ${line}`), "");
  }
  out.push("EDUCATION");
  for (const item of draft.education) {
    if (![item.school, item.credential].some((field) => String(field || "").trim())) continue;
    out.push([item.credential, item.school, item.year].filter(Boolean).join(" | "));
  }
  if (draft.certifications.trim()) out.push("", "CERTIFICATIONS", draft.certifications);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
function suggestedSummary(draft) {
  const target = draft.headline.trim();
  const skills = draft.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const experience = draft.experience.find((entry) => entry.title?.trim() || entry.details?.trim());
  if (!target && !skills.length && !experience) return "";
  // Every fact in the suggestion comes from the job seeker's own form.
  const intro = target ? `Professional seeking ${target} opportunities` : "Motivated professional";
  const background = experience?.title?.trim() ? ` with experience as ${experience.title.trim()}` : "";
  const strengths = skills.length ? `. Skills include ${skills.join(", ")}` : "";
  return `${intro}${background}${strengths}. Ready to contribute these strengths in a new role.`;
}
const inputClass = "w-full min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const labelClass = "block text-sm font-semibold text-foreground mb-1.5";

function Field({ label, value, onChange, type = "text", placeholder, autoComplete }) {
  return <label className="block"><span className={labelClass}>{label}</span><input className={inputClass} type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} /></label>;
}
function Multiline({ label, value, onChange, placeholder, rows = 4 }) {
  return <label className="block"><span className={labelClass}>{label}</span><textarea className={inputClass} rows={rows} value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
function ResumePreview({ draft }) {
  const compact = draft.template === "classic";
  return <article id="titan-resume-print" aria-label="Résumé preview" className={`bg-white text-slate-900 p-6 sm:p-9 rounded-xl border border-slate-200 shadow-sm min-h-[540px] ${compact ? "font-serif" : "font-sans"}`}>
    <header className="border-b border-slate-300 pb-4 mb-5">
      <h2 className="font-bold tracking-tight text-2xl sm:text-3xl break-words">{draft.fullName || "Your name"}</h2>
      {draft.headline && <p className="font-medium text-slate-700 mt-1">{draft.headline}</p>}
      <p className="text-xs mt-2 break-words">{[draft.location, draft.phone, draft.email].filter(Boolean).join(" • ")}</p>
    </header>
    {draft.summary && <section className="mb-5"><h3 className="font-bold text-xs uppercase tracking-widest mb-2">Professional Summary</h3><p className="text-sm whitespace-pre-wrap leading-relaxed">{draft.summary}</p></section>}
    {draft.skills && <section className="mb-5"><h3 className="font-bold text-xs uppercase tracking-widest mb-2">Skills</h3><p className="text-sm whitespace-pre-wrap">{draft.skills}</p></section>}
    {draft.experience.some((item) => item.title || item.employer || item.details) && <section className="mb-5"><h3 className="font-bold text-xs uppercase tracking-widest mb-2">Experience</h3>{draft.experience.map((item) => <div key={item.id} className="mb-4"><div className="flex flex-wrap justify-between gap-1"><strong className="text-sm">{[item.title, item.employer].filter(Boolean).join(" · ")}</strong><span className="text-xs">{[item.start, item.end || (item.start ? "Present" : "")].filter(Boolean).join(" – ")}</span></div>{item.location && <p className="text-xs text-slate-600">{item.location}</p>}<p className="whitespace-pre-wrap text-sm leading-relaxed mt-1">{item.details}</p></div>)}</section>}
    {draft.education.some((item) => item.school || item.credential) && <section className="mb-5"><h3 className="font-bold text-xs uppercase tracking-widest mb-2">Education</h3>{draft.education.map((item) => <p key={item.id} className="text-sm mb-2">{[item.credential, item.school, item.year].filter(Boolean).join(" · ")}</p>)}</section>}
    {draft.certifications && <section><h3 className="font-bold text-xs uppercase tracking-widest mb-2">Licenses & Certifications</h3><p className="text-sm whitespace-pre-wrap">{draft.certifications}</p></section>}
  </article>;
}
export default function ResumeBuilder() {
  const { user } = useAuth();
  const userId = user?.id;
  const [draft, setDraft] = useState(initial);
  const [loadedFor, setLoadedFor] = useState(null);
  const [notice, setNotice] = useState("");
  const importInput = useRef(null);
  useEffect(() => {
    setDraft(readResume(userId));
    setLoadedFor(userId || null);
    setNotice("");
  }, [userId]);
  useEffect(() => {
    if (!userId || loadedFor !== userId) return;
    try { localStorage.setItem(`titanos:resume:v1:${userId}`, JSON.stringify(draft)); }
    catch { setNotice("Device storage is unavailable. Download a copy before closing this page."); }
  }, [draft, userId, loadedFor]);
  const update = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }));
  const updateEntry = (field, id, key, value) => setDraft((previous) => ({ ...previous, [field]: previous[field].map((item) => item.id === id ? { ...item, [key]: value } : item) }));
  const removeEntry = (field, id) => setDraft((previous) => ({ ...previous, [field]: previous[field].filter((item) => item.id !== id) }));
  const addEntry = (field) => setDraft((previous) => ({ ...previous, [field]: [...previous[field], field === "experience" ? emptyExperience() : emptyEducation()] }));
  const plainText = useMemo(() => buildPlainText(draft), [draft]);
  function download() {
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(draft.fullName || "My_Resume").replace(/[^a-z0-9_-]+/gi, "_")}_Resume.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function downloadBackup() {
    const filename = (draft.fullName || "My_Resume").replace(/[^a-z0-9_-]+/gi, "_");
    const backup = { format: "TitanOS-Resume-Backup", version: 1, exportedAt: new Date().toISOString(), data: normalizeResume(draft) };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename}_TitanOS_Backup.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Backup prepared. Store it securely because it contains your personal résumé details.");
  }
  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 512 * 1024) throw new Error("Backup must be under 512 KB.");
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== "TitanOS-Resume-Backup" || parsed?.version !== 1 || !parsed.data || typeof parsed.data !== "object") {
        throw new Error("Choose a TitanOS résumé backup JSON file.");
      }
      setDraft(normalizeResume(parsed.data));
      setNotice("Résumé backup imported. Your changes will save to this device.");
    } catch (error) {
      setNotice(error.message || "Could not import the résumé backup.");
    } finally {
      event.target.value = "";
    }
  }
  function print() { window.print(); }
  function polish() {
    const proposal = suggestedSummary(draft);
    if (!proposal) return setNotice("Add a desired role, real experience, or skills before generating a summary.");
    update("summary", proposal);
    setNotice("Summary draft created from the information you entered. Review it for accuracy.");
  }
  return <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 space-y-6" data-testid="resume-builder">
    <style>{`@media print { body * { visibility: hidden !important; } #titan-resume-print, #titan-resume-print * { visibility: visible !important; } #titan-resume-print { position: absolute !important; top: 0; left: 0; width: 100%; border: 0; box-shadow: none; padding: 0 !important; color: #111 !important; } @page { size: letter; margin: 0.65in; } }`}</style>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Career tools</p><h1 className="text-3xl font-bold mt-1">Résumé Builder</h1><p className="text-sm text-muted-foreground mt-1">Build a professional résumé, preview it, and export it without advertising.</p></div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="min-h-11 px-4 rounded-lg border border-border bg-card inline-flex gap-2 items-center" onClick={download}><Download className="h-4 w-4"/> Download text</button>
        <button type="button" className="min-h-11 px-4 rounded-lg border border-border bg-card inline-flex gap-2 items-center" onClick={downloadBackup}><Download className="h-4 w-4"/> Export backup</button>
        <button type="button" className="min-h-11 px-4 rounded-lg border border-border bg-card inline-flex gap-2 items-center" onClick={() => importInput.current?.click()}>Import backup</button>
        <input ref={importInput} type="file" accept=".json,application/json" onChange={importBackup} aria-label="Select TitanOS résumé backup" className="sr-only" />
        <button type="button" className="min-h-11 px-4 rounded-lg bg-primary text-primary-foreground font-semibold inline-flex gap-2 items-center" onClick={print}><Printer className="h-4 w-4"/> Print / Save PDF</button>
      </div>
    </header>
    {notice && <div role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">{notice}</div>}
    <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm text-muted-foreground">Your draft saves automatically <strong>on this device</strong> for the signed-in account. It does not sync between devices yet. Use Export backup and Import backup to move a résumé securely between devices. Only include information you want employers to see.</div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
        <section className="titan-surface p-4 sm:p-5 space-y-4">
          <h2 className="font-bold text-lg">Contact & Target Role</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" value={draft.fullName} onChange={(v) => update("fullName", v)} autoComplete="name"/>
            <Field label="Email" type="email" value={draft.email} onChange={(v) => update("email", v)} autoComplete="email"/>
            <Field label="Phone" type="tel" value={draft.phone} onChange={(v) => update("phone", v)} autoComplete="tel"/>
            <Field label="City and state" value={draft.location} onChange={(v) => update("location", v)} placeholder="Oklahoma City, OK"/>
          </div>
          <Field label="Target job title" value={draft.headline} onChange={(v) => update("headline", v)} placeholder="Delivery Driver / Logistics Associate"/>
          <Multiline label="Professional summary" value={draft.summary} onChange={(v) => update("summary", v)} placeholder="Summarize your verified experience and what you bring to the job."/>
          <button type="button" onClick={polish} className="rounded-lg bg-primary/10 text-primary px-3 py-2 min-h-11 flex gap-2 items-center font-semibold text-sm"><Sparkles className="h-4 w-4"/> Draft summary from my facts</button>
          <Multiline label="Skills (comma-separated)" rows={2} value={draft.skills} onChange={(v) => update("skills", v)} placeholder="Route planning, safe driving, customer service"/>
        </section>
        <section className="titan-surface p-4 sm:p-5 space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-lg">Work Experience</h2><button type="button" className="min-h-11 text-sm text-primary inline-flex items-center gap-1" onClick={() => addEntry("experience")}><Plus className="h-4 w-4"/> Add position</button></div>
          {draft.experience.map((item, i) => <div className="space-y-3 border border-border rounded-lg p-3" key={item.id}>
            <div className="flex justify-between items-center"><strong className="text-sm">Position {i + 1}</strong><button type="button" aria-label={`Remove position ${i + 1}`} onClick={() => removeEntry("experience", item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4"/></button></div>
            <div className="grid sm:grid-cols-2 gap-3"><Field label="Job title" value={item.title} onChange={(v) => updateEntry("experience", item.id, "title", v)}/><Field label="Employer" value={item.employer} onChange={(v) => updateEntry("experience", item.id, "employer", v)}/><Field label="Start date" value={item.start} onChange={(v) => updateEntry("experience", item.id, "start", v)} placeholder="Jan 2022"/><Field label="End date (or Present)" value={item.end} onChange={(v) => updateEntry("experience", item.id, "end", v)}/></div>
            <Field label="Location" value={item.location} onChange={(v) => updateEntry("experience", item.id, "location", v)}/><Multiline label="Responsibilities & achievements" value={item.details} onChange={(v) => updateEntry("experience", item.id, "details", v)} placeholder="Use specific, accurate results. One achievement per line."/>
          </div>)}
        </section>
        <section className="titan-surface p-4 sm:p-5 space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-lg">Education</h2><button type="button" className="min-h-11 text-sm text-primary inline-flex items-center gap-1" onClick={() => addEntry("education")}><Plus className="h-4 w-4"/> Add education</button></div>
          {draft.education.map((item, i) => <div className="space-y-3 border border-border rounded-lg p-3" key={item.id}><div className="flex justify-between items-center"><strong className="text-sm">Education {i + 1}</strong><button type="button" aria-label={`Remove education ${i + 1}`} onClick={() => removeEntry("education", item.id)}><Trash2 className="h-4 w-4"/></button></div>
            <Field label="School or program" value={item.school} onChange={(v) => updateEntry("education", item.id, "school", v)}/><Field label="Certificate, diploma, or degree" value={item.credential} onChange={(v) => updateEntry("education", item.id, "credential", v)}/><Field label="Completion year" value={item.year} onChange={(v) => updateEntry("education", item.id, "year", v)}/>
          </div>)}
          <Multiline label="Licenses & Certifications" value={draft.certifications} onChange={(v) => update("certifications", v)} rows={2} placeholder="List only current licenses or certifications you hold."/>
        </section>
        <section className="titan-surface p-4 sm:p-5 space-y-3"><h2 className="font-bold text-lg">Design</h2><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={draft.template === "modern"} onClick={() => update("template", "modern")} className={`min-h-11 px-4 rounded-lg border ${draft.template === "modern" ? "border-primary bg-primary/10" : "border-border"}`}>Modern</button><button type="button" aria-pressed={draft.template === "classic"} onClick={() => update("template", "classic")} className={`min-h-11 px-4 rounded-lg border ${draft.template === "classic" ? "border-primary bg-primary/10" : "border-border"}`}>Classic</button></div></section>
      </form>
      <aside className="lg:sticky lg:top-20 lg:self-start"><div className="flex items-center gap-2 mb-3 text-sm font-semibold"><FileText className="h-4 w-4"/> Live preview</div><ResumePreview draft={draft}/><p className="text-xs text-muted-foreground mt-3">Use Print / Save PDF to open your device's print or PDF save flow. No data is sent to employers automatically.</p></aside>
    </div>
  </div>;
}
