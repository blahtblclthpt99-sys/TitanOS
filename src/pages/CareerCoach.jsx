import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpen, BriefcaseBusiness, Check, ClipboardCopy, FileText, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

function loadResume(userId) {
  if (!userId) return null;
  try {return JSON.parse(localStorage.getItem(`titanos:resume:v1:${userId}`) || "null");}
  catch {return null;}
}
function compose({name,role,company,skills,experience,motivation}) {
  const safeRole=role.trim(), safeCompany=company.trim();
  if (!safeRole) return "";
  return [
    safeCompany ? `Dear ${safeCompany} Hiring Team,` : "Dear Hiring Manager,",
    "",
    `I am interested in the ${safeRole} position${safeCompany ? ` at ${safeCompany}` : ""}. ${motivation.trim() || "I would appreciate the opportunity to contribute to your team."}`,
    "",
    experience.trim() ? `My relevant experience includes ${experience.trim().replace(/[.!?]+$/, "")}.` : "",
    skills.trim() ? `My skills include ${skills.trim().replace(/[.!?]+$/, "")}.` : "",
    "",
    "I would welcome the chance to discuss how my experience and skills align with your needs. Thank you for considering my application.",
    "",
    "Sincerely,",
    name.trim() || "Your name",
  ].filter((line, i, arr) => !(line === "" && arr[i-1] === "")).join("\n");
}
const questions=[
  "Tell me about yourself and your work experience.",
  "Why are you interested in this position?",
  "Describe a challenging task you completed successfully.",
  "How do you prioritize competing deadlines?",
  "What experience or skills make you a strong match?",
  "What questions do you have about the role and team?",
];
const input="block w-full rounded-lg border border-border bg-background px-3 py-3 min-h-11 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const label="block text-sm font-semibold mb-1.5";
export default function CareerCoach(){
  const {user}=useAuth();
  const [form,setForm]=useState({name:"",role:"",company:"",skills:"",experience:"",motivation:""});
  const [letter,setLetter]=useState("");
  const [feedback,setFeedback]=useState("");
  useEffect(()=>{
    const resume=loadResume(user?.id);
    setForm((previous)=>({
      ...previous,
      name: resume?.fullName || user?.user_metadata?.full_name || previous.name,
      skills: resume?.skills || previous.skills,
      experience: resume?.summary || resume?.experience?.find((x)=>x.details)?.details || previous.experience,
      role: resume?.headline || previous.role,
    }));
  },[user?.id, user?.user_metadata?.full_name]);
  const preview=useMemo(()=>compose(form),[form]);
  const change=(key,value)=>{setForm((previous)=>({...previous,[key]:value}));setFeedback("");};
  function create(){
    if(!form.role.trim())return setFeedback("Enter the job title you are applying for first.");
    setLetter(preview);
    setFeedback("Cover-letter draft prepared. Read and personalize it before sharing.");
  }
  async function copy(){
    if(!letter.trim())return setFeedback("Create or edit a letter before copying it.");
    try{await navigator.clipboard.writeText(letter);setFeedback("Letter copied to clipboard.");}
    catch{setFeedback("Clipboard access is unavailable. Select the letter text and copy it manually.");}
  }
  return <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-primary">Job search preparation</p><h1 className="text-3xl font-bold mt-2">Career Coach</h1><p className="text-muted-foreground text-sm mt-2">Write a role-specific cover letter and practice interview questions. Your wording stays under your control.</p></header>
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex gap-2 items-center"><FileText className="h-5 w-5 text-primary"/><h2 className="text-xl font-bold">Cover Letter Builder</h2></div>
        <p className="text-xs text-muted-foreground">Uses your own résumé data from this device where available. Nothing is sent automatically.</p>
        {[
          ["name","Your full name","text"],
          ["role","Job title you want","text"],
          ["company","Company (optional)","text"],
        ].map(([key,title,type])=><label key={key} className="block"><span className={label}>{title}</span><input className={input} type={type} value={form[key]} onChange={(event)=>change(key,event.target.value)}/></label>)}
        <label className="block"><span className={label}>Relevant experience</span><textarea rows={3} className={input} value={form.experience} onChange={(event)=>change("experience",event.target.value)} placeholder="Describe experience you really have"/></label>
        <label className="block"><span className={label}>Your strengths and skills</span><textarea rows={2} className={input} value={form.skills} onChange={(event)=>change("skills",event.target.value)}/></label>
        <label className="block"><span className={label}>Why this job interests you</span><textarea rows={3} className={input} value={form.motivation} onChange={(event)=>change("motivation",event.target.value)} placeholder="Explain why you want to work here"/></label>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={create} className="min-h-11 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm inline-flex gap-2 items-center"><Sparkles className="h-4 w-4"/> Prepare letter</button>
          <Link to="/resume" className="min-h-11 px-4 rounded-lg border border-border inline-flex gap-2 items-center text-sm font-semibold"><FileText className="h-4 w-4"/> Edit résumé</Link>
        </div>
      </section>
      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap"><h2 className="font-bold text-lg">Your editable letter</h2><button type="button" onClick={copy} disabled={!letter} className="min-h-10 px-3 rounded-lg border border-border inline-flex gap-2 items-center text-sm disabled:opacity-50"><ClipboardCopy className="h-4 w-4"/> Copy</button></div>
          <textarea className={input} value={letter} onChange={(event)=>setLetter(event.target.value)} rows={16} aria-label="Editable cover letter" placeholder="Complete the form and select Prepare letter." />
          <p className="text-xs text-muted-foreground">This is a structured writing assistant, not a live AI service. Verify names, qualifications and claims before submitting.</p>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3"><BookOpen className="h-5 w-5 text-primary"/><h2 className="font-bold text-lg">Interview practice</h2></div>
          <ol className="space-y-3">{questions.map((q,i)=><li key={q} className="text-sm flex gap-3"><span className="font-bold text-primary">{i+1}.</span><span>{q}</span></li>)}</ol>
          <p className="text-xs text-muted-foreground mt-4">Use the STAR structure: Situation, Task, Action and Result. Give real examples and avoid inventing experience.</p>
        </section>
      </div>
    </div>
    {feedback && <div role="status" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">{feedback}</div>}
    <p className="text-xs text-muted-foreground flex gap-2 items-center"><Check className="h-4 w-4 shrink-0"/><span>Applications and personal data are never submitted to employers without your approval.</span></p>
    <Link to="/hire" className="inline-flex gap-2 items-center text-primary font-semibold text-sm"><BriefcaseBusiness className="h-4 w-4"/> Find jobs to apply for</Link>
  </div>;
}
