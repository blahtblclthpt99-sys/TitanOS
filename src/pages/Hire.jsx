import React, { useEffect, useState } from "react";
import { BriefcaseBusiness, CalendarDays, Check, Loader2, MapPin, Search, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import FormField from "@/components/shared/FormField";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { useAuth } from "@/lib/AuthContext";
import { SERVICE_CATEGORIES, US_STATES, timeAgo } from "@/lib/platformConstants";
import { betaBadgeLabel } from "@/lib/plan";
import { applyToHireJob, createHireJob, formatBudget, hireApplicant, listApplicationsForJob, listHireJobs, listMyApplications, locationLabel } from "@/lib/hireApi";
import ReviewForm from "@/components/shared/ReviewForm";

const BLANK_JOB = { title: "", description: "", category: "General", city: "", state: "", budget_min: "", budget_max: "", deadline: "", imageUrl: "" };
const fieldClass = "bg-titan-surface2 border-white/10 text-white rounded-xl focus:border-titan-cyan/40";

function EmptyPanel({ title, detail, action }) {
  return <div className="glass rounded-3xl p-12 text-center border border-white/8"><BriefcaseBusiness className="w-9 h-9 text-titan-cyan mx-auto mb-3" /><p className="font-semibold text-white">{title}</p><p className="text-sm text-white/40 mt-1">{detail}</p>{action}</div>;
}

export default function Hire() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [tab, setTab] = useState("browse");
  const [filters, setFilters] = useState({ search: "", category: "All", state: "" });
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobForm, setJobForm] = useState(BLANK_JOB);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyForm, setApplyForm] = useState({ message: "", bid_amount: "" });
  const [applicants, setApplicants] = useState({});

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      if (tab === "browse") setJobs(await listHireJobs(filters));
      else if (tab === "posts") {
        const rows = await listHireJobs({ status: "all" });
        const mine = rows.filter((job) => job.customer_id === user.id);
        setJobs(mine);
        const entries = await Promise.all(mine.map(async (job) => [job.id, await listApplicationsForJob(job.id)]));
        setApplicants(Object.fromEntries(entries));
      } else if (tab === "applications") setApplications(await listMyApplications(user.id));
    } catch {
      toast({ variant: "destructive", title: "Couldn't load Hire", description: "Please try again." });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (authChecked && user?.id) load(); }, [authChecked, user?.id, tab, filters.search, filters.category, filters.state]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const saveJob = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await createHireJob(user, { ...jobForm, images: jobForm.imageUrl ? [jobForm.imageUrl] : [] });
      toast({ title: "Job posted", description: "Local professionals can now apply." });
      setJobForm(BLANK_JOB); setTab("posts");
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't post job", description: error.message || "Please try again." });
    } finally { setSaving(false); }
  };
  const submitApplication = async (event) => {
    event.preventDefault();
    if (saving || !selectedJob) return;
    setSaving(true);
    try {
      await applyToHireJob(user, selectedJob.id, applyForm);
      toast({ title: "Application sent", description: "The job poster will be notified." });
      setSelectedJob(null); setApplyForm({ message: "", bid_amount: "" });
    } catch { toast({ variant: "destructive", title: "Couldn't send application" }); }
    finally { setSaving(false); }
  };
  const hire = async (job, application) => {
    if (saving || !window.confirm(`Hire ${application.worker_name || "this applicant"}?`)) return;
    setSaving(true);
    try {
      await hireApplicant(job, application);
      toast({ title: "Applicant hired", description: "They've been notified." });
      load();
    } catch { toast({ variant: "destructive", title: "Couldn't hire applicant" }); }
    finally { setSaving(false); }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading Hire" />;
  return <div className="relative p-4 md:p-8 max-w-6xl mx-auto pb-32">
    <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-titan-cyan/8 blur-[100px]" /></div>
    <div className="relative">
      <PageHeader title="Hire" subtitle="Find local help and grow your service network" />
      {betaBadgeLabel() && <div className="glass rounded-2xl mb-5 p-4 border border-titan-cyan/20 flex justify-between gap-3"><div><p className="font-semibold text-white">{betaBadgeLabel()}</p><p className="text-xs text-white/40 mt-1">Post jobs and connect with local professionals at no cost.</p></div><span className="text-xs font-medium text-titan-cyan whitespace-nowrap">No fees</span></div>}
      <div className="flex overflow-x-auto gap-2 mb-6 border-b border-white/8">{[["browse", "Browse Jobs"], ["post", "Post a Job"], ["posts", "My Posts"], ["applications", "My Applications"]].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === id ? "border-titan-cyan text-titan-cyan" : "border-transparent text-white/40 hover:text-white/70"}`}>{label}</button>)}</div>
      {tab === "browse" && <><div className="glass rounded-2xl p-4 mb-6 border border-white/8 grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-white/30" /><Input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search jobs" className={`${fieldClass} pl-9`} /></div><select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)} className={fieldClass}><option value="All">All categories</option>{SERVICE_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select><select value={filters.state} onChange={(e) => updateFilter("state", e.target.value)} className={fieldClass}><option value="">All states</option>{US_STATES.map((value) => <option key={value}>{value}</option>)}</select></div>
        {loading ? <PageLoader variant="list" label="Loading jobs" /> : jobs.length ? <div className="grid md:grid-cols-2 gap-4">{jobs.map((job) => <article key={job.id} className="glass rounded-2xl p-5 border border-white/8"><div className="flex justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold text-white truncate">{job.title}</h2><p className="text-xs text-titan-cyan mt-1">{job.category}</p></div><p className="text-xs text-white/35 whitespace-nowrap">{timeAgo(job.created_date || job.created_at)}</p></div><p className="text-sm text-white/55 leading-relaxed mt-3 line-clamp-2">{job.description}</p><div className="flex justify-between items-end mt-4 pt-3 border-t border-white/6"><div className="space-y-1 text-xs text-white/40"><p className="flex gap-1 items-center"><MapPin className="w-3 h-3" />{locationLabel(job.city, job.state) || "Location not provided"}</p>{job.deadline && <p className="flex gap-1 items-center"><CalendarDays className="w-3 h-3" />Due {new Date(`${job.deadline}T12:00:00`).toLocaleDateString()}</p>}</div><div className="text-right"><p className="font-bold text-titan-cyan">{formatBudget(job)}</p><Button onClick={() => { setSelectedJob(job); setApplyForm({ message: "", bid_amount: "" }); }} className="mt-2 bg-titan-cyan text-black h-8">Apply</Button></div></div></article>)}</div> : <EmptyPanel title="No jobs found" detail="Try broadening your search or check back soon." />}</>}
      {tab === "post" && <form onSubmit={saveJob} className="glass rounded-3xl p-5 md:p-7 border border-white/8 max-w-3xl"><div className="grid sm:grid-cols-2 gap-4"><FormField label="Job title" value={jobForm.title} onChange={(e) => setJobForm((x) => ({ ...x, title: e.target.value }))} required /><FormField label="Category"><select value={jobForm.category} onChange={(e) => setJobForm((x) => ({ ...x, category: e.target.value }))} className={fieldClass}>{SERVICE_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></FormField></div><FormField label="Description"><Textarea required rows={5} value={jobForm.description} onChange={(e) => setJobForm((x) => ({ ...x, description: e.target.value }))} className={fieldClass} /></FormField><div className="grid sm:grid-cols-2 gap-4"><FormField label="City" value={jobForm.city} onChange={(e) => setJobForm((x) => ({ ...x, city: e.target.value }))} /><FormField label="State"><select value={jobForm.state} onChange={(e) => setJobForm((x) => ({ ...x, state: e.target.value }))} className={fieldClass}><option value="">Select state</option>{US_STATES.map((value) => <option key={value}>{value}</option>)}</select></FormField><FormField label="Minimum budget"><Input type="number" min="0" value={jobForm.budget_min} onChange={(e) => setJobForm((x) => ({ ...x, budget_min: e.target.value }))} className={fieldClass} /></FormField><FormField label="Maximum budget"><Input type="number" min="0" value={jobForm.budget_max} onChange={(e) => setJobForm((x) => ({ ...x, budget_max: e.target.value }))} className={fieldClass} /></FormField><FormField label="Deadline"><Input type="date" value={jobForm.deadline} onChange={(e) => setJobForm((x) => ({ ...x, deadline: e.target.value }))} className={fieldClass} /></FormField><FormField label="Image URL"><Input type="url" placeholder="https://..." value={jobForm.imageUrl} onChange={(e) => setJobForm((x) => ({ ...x, imageUrl: e.target.value }))} className={fieldClass} /></FormField></div><Button disabled={saving} type="submit" className="w-full mt-5 bg-titan-cyan text-black font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Job"}</Button></form>}
      {tab === "posts" && (loading ? <PageLoader variant="list" label="Loading your posts" /> : jobs.length ? <div className="space-y-4">{jobs.map((job) => <section key={job.id} className="glass rounded-2xl p-5 border border-white/8"><div className="flex justify-between gap-3"><div><h2 className="font-semibold text-white">{job.title}</h2><p className="text-xs text-white/40 mt-1">{job.category} · {formatBudget(job)}</p></div><span className={`text-xs px-2 py-1 rounded-lg h-fit ${job.status === "hired" ? "bg-emerald-400/15 text-emerald-400" : "bg-titan-cyan/10 text-titan-cyan"}`}>{job.status}</span></div><div className="mt-4 pt-4 border-t border-white/6"><p className="text-xs uppercase tracking-widest text-white/35 mb-2">Applications ({applicants[job.id]?.length || 0})</p>{applicants[job.id]?.length ? applicants[job.id].map((app) => <div key={app.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-t border-white/5 first:border-0"><div className="flex-1"><p className="text-sm text-white flex items-center gap-1"><UserRound className="w-3 h-3 text-white/40" />{app.worker_name || "Applicant"}</p><p className="text-xs text-white/40 mt-1">{app.message || "No message provided"}{app.bid_amount ? ` · Bid: $${app.bid_amount}` : ""}</p></div>{app.status === "accepted" ? <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Hired</span> : job.status === "open" && <Button onClick={() => hire(job, app)} disabled={saving} className="bg-titan-cyan text-black h-8">Hire</Button>}</div>) : <p className="text-sm text-white/35">No applications yet.</p>}{job.status === "hired" && job.hired_worker_id && <div className="mt-4"><ReviewForm revieweeId={job.hired_worker_id} reviewerRole="customer" hireJobId={job.id} /></div>}</div></section>)}</div> : <EmptyPanel title="No jobs posted" detail="Post a job to find the right local professional." action={<Button onClick={() => setTab("post")} className="mt-4 bg-titan-cyan text-black">Post a Job</Button>} />)}
      {tab === "applications" && (loading ? <PageLoader variant="list" label="Loading applications" /> : applications.length ? <div className="space-y-3">{applications.map((app) => <article key={app.id} className="glass rounded-2xl p-5 border border-white/8"><div className="flex justify-between gap-3"><div><h2 className="font-semibold text-white">{app.hire_job_title || "Job application"}</h2><p className="text-xs text-white/40 mt-1">{app.message || "Application submitted"}{app.bid_amount ? ` · Bid: $${app.bid_amount}` : ""}</p></div><span className={`text-xs h-fit px-2 py-1 rounded-lg ${app.status === "accepted" ? "bg-emerald-400/15 text-emerald-400" : "bg-white/5 text-white/50"}`}>{app.status}</span></div></article>)}</div> : <EmptyPanel title="No applications yet" detail="Browse open jobs to find your next opportunity." action={<Button onClick={() => setTab("browse")} className="mt-4 bg-titan-cyan text-black">Browse Jobs</Button>} />)}
    </div>
    <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}><DialogContent className="bg-titan-surface1 border-white/10 text-white max-w-md rounded-2xl">{selectedJob && <><DialogHeader><DialogTitle>Apply to {selectedJob.title}</DialogTitle></DialogHeader><form onSubmit={submitApplication} className="space-y-4"><FormField label="Message"><Textarea required rows={4} value={applyForm.message} onChange={(e) => setApplyForm((x) => ({ ...x, message: e.target.value }))} placeholder="Introduce yourself and describe your experience." className={fieldClass} /></FormField><FormField label="Your bid (optional)"><Input type="number" min="0" value={applyForm.bid_amount} onChange={(e) => setApplyForm((x) => ({ ...x, bid_amount: e.target.value }))} className={fieldClass} /></FormField><Button disabled={saving} type="submit" className="w-full bg-titan-cyan text-black">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send Application</>}</Button></form></>}</DialogContent></Dialog>
  </div>;
}
