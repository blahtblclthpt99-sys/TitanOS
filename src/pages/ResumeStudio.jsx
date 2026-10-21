import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Download, Printer, Save } from "lucide-react";

const key = "titanos-career-resume-v1";
const initial = { name: "", email: "", phone: "", location: "", headline: "", summary: "", experience: "", education: "", skills: "" };
function load() {
  try { return { ...initial, ...JSON.parse(localStorage.getItem(key) || "{}") }; }
  catch { return initial; }
}
function textResume(data) {
  return [
    data.name, [data.email, data.phone, data.location].filter(Boolean).join(" | "),
    data.headline, "", "PROFESSIONAL SUMMARY", data.summary,
    "", "EXPERIENCE", data.experience, "", "EDUCATION", data.education,
    "", "SKILLS", data.skills
  ].join("\n").trim() + "\n";
}
export default function ResumeStudio() {
  const [form, setForm] = useState(load);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(form)); setNotice("Saved on this device"); }
      catch { setNotice("Could not save. Check device storage."); }
    }, 500);
    return () => clearTimeout(timeout);
  }, [form]);
  function update(field, value) { setForm(current => ({ ...current, [field]: value })); setNotice("Unsaved changes"); }
  function download() {
    const blob = new Blob([textResume(form)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "TitanOS-Resume.txt"; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  const fields = [
    ["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["location", "City and state"],
    ["headline", "Professional headline"], ["summary", "Professional summary"],
    ["experience", "Work experience (company, title, dates and achievements)"],
    ["education", "Education and certifications"], ["skills", "Skills"]
  ];
  return (
    <section className="resume-studio mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <Link to="/career" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"><ArrowLeft size={17}/> Back to careers</Link>
      <header><h1 className="text-2xl font-bold text-foreground">Résumé Builder</h1>
        <p className="mt-2 text-sm text-muted-foreground">Build your résumé. Changes save locally on this device—not to your TitanOS account yet.</p></header>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground"><Save size={14} className="mr-1 inline"/>{notice}</p>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        {fields.map(([field, label]) => <label key={field} className="block space-y-1.5">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {["summary","experience","education","skills"].includes(field)
            ? <textarea rows={field === "experience" ? 6 : 3} value={form[field]} onChange={e=>update(field,e.target.value)} className="w-full rounded-lg border border-border bg-background p-3 text-foreground" />
            : <input type={field==="email" ? "email" : field==="phone" ? "tel" : "text"} autoCapitalize={field==="email" ? "none" : "sentences"} value={form[field]} onChange={e=>update(field,e.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-background p-3 text-foreground" />}
        </label>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"><Download size={17}/> Download text</button>
        <button type="button" onClick={()=>window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 font-semibold text-foreground"><Printer size={17}/> Print / Save PDF</button>
      </div>
      <p className="text-xs text-muted-foreground">On supported devices, Print may offer “Save as PDF.” Export a copy before clearing app data.</p>
      <style>{`@media print { body { background: white !important; } body * { visibility: hidden !important; } .resume-print-preview, .resume-print-preview * { visibility: visible !important; } .resume-print-preview { position: absolute !important; inset: 0 auto auto 0; width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; } @page { margin: 16mm; } }`}</style>
      <article className="resume-print-preview space-y-3 rounded-xl border border-border bg-white p-6 text-black print:border-0 print:p-0" aria-label="Résumé preview">
        <h2 className="text-2xl font-bold">{form.name || "Your Name"}</h2>
        <p className="text-sm">{[form.email,form.phone,form.location].filter(Boolean).join(" • ")}</p>
        {form.headline && <p className="font-semibold">{form.headline}</p>}
        {[[ "Professional Summary", form.summary ],["Experience",form.experience],["Education",form.education],["Skills",form.skills]].map(([title,value])=><section key={title}>
          <h3 className="border-b pb-1 font-bold">{title}</h3>
          <p className="whitespace-pre-wrap text-sm">{value || "Add information above to complete this section."}</p>
        </section>)}
      </article>
    </section>
  );
}
