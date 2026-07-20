import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bookmark, BriefcaseBusiness, CalendarDays, Check, Loader2, MapPin, MessageCircle, Search, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import FormField from "@/components/shared/FormField";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import PageShell from "@/components/shared/PageShell";
import EmptyState from "@/components/shared/EmptyState";
import ReviewForm from "@/components/shared/ReviewForm";
import { useAuth } from "@/lib/AuthContext";
import { SERVICE_CATEGORIES, US_STATES, timeAgo } from "@/lib/platformConstants";
import { betaBadgeLabel } from "@/lib/plan";
import {
  applyToHireJob, createHireJob, formatBudget, hireApplicant, listApplicationsForJob,
  listHireJobs, listHireMessages, listMyApplications, listSavedJobIds, listSavedJobs,
  locationLabel, sendHireMessage, toggleSaveJob,
} from "@/lib/hireApi";

const BLANK_JOB = { title: "", description: "", category: "General", city: "", state: "", budget_min: "", budget_max: "", deadline: "", imageUrl: "", is_same_day: false, is_urgent: false };
const fieldClass = "bg-muted border-border text-foreground rounded-md";

function JobCard({ job, saved, onSave, onApply }) {
  return (
    <article className="titan-surface p-5">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground truncate">{job.title}</h2>
          <p className="text-xs text-primary mt-1">{job.category}</p>
          {(job.is_same_day || job.is_urgent) && (
            <div className="flex gap-1 mt-2">
              {job.is_same_day && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-warning/15 text-warning">Same day</span>
              )}
              {job.is_urgent && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-destructive/15 text-destructive">Urgent</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => onSave(job.id)}
            aria-label={saved ? "Remove saved job" : "Save job"}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-primary focus-ring"
          >
            <Bookmark className={`w-5 h-5 ${saved ? "fill-primary text-primary" : ""}`} />
          </button>
          <p className="text-xs text-muted-foreground whitespace-nowrap pt-3">
            {timeAgo(job.created_date || job.created_at)}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mt-3 line-clamp-2">{job.description}</p>
      <div className="flex justify-between items-end mt-4 pt-3 border-t border-border">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex gap-1 items-center">
            <MapPin className="w-3 h-3" />
            {locationLabel(job.city, job.state) || "Location not provided"}
          </p>
          {job.deadline && (
            <p className="flex gap-1 items-center">
              <CalendarDays className="w-3 h-3" />
              Due {new Date(`${job.deadline}T12:00:00`).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-primary">{formatBudget(job)}</p>
          <Button onClick={() => onApply(job)} size="sm" className="mt-2">
            Apply
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function Hire() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (searchParams.get("new") === "1" ? "post" : "browse"));
  const [filters, setFilters] = useState({ search: "", category: "All", state: "" });
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobForm, setJobForm] = useState(BLANK_JOB);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyForm, setApplyForm] = useState({ message: "", bid_amount: "" });
  const [applicants, setApplicants] = useState({});
  const [jobById, setJobById] = useState({});
  const [messageTarget, setMessageTarget] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageBody, setMessageBody] = useState("");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setTab("post");
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const saves = await listSavedJobIds(user.id);
      setSavedIds(saves);
      if (tab === "browse") setJobs(await listHireJobs(filters));
      else if (tab === "saved") setJobs(await listSavedJobs(user.id));
      else if (tab === "posts") {
        const mine = (await listHireJobs({ status: "all" })).filter((job) => job.customer_id === user.id);
        setJobs(mine);
        setApplicants(Object.fromEntries(await Promise.all(mine.map(async (job) => [job.id, await listApplicationsForJob(job.id)]))));
      } else if (tab === "applications") {
        const rows = await listMyApplications(user.id);
        setApplications(rows);
        const allJobs = await listHireJobs({ status: "all" });
        setJobById(Object.fromEntries(allJobs.map((job) => [job.id, job])));
      }
    } catch {
      toast({ variant: "destructive", title: "Couldn't load Hire", description: "Please try again." });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (authChecked && user?.id) load(); }, [authChecked, user?.id, tab, filters.search, filters.category, filters.state]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const openApply = (job) => { setSelectedJob(job); setApplyForm({ message: "", bid_amount: "" }); };
  const saveToggle = async (jobId) => {
    if (saving) return;
    setSaving(true);
    try {
      const isSaved = await toggleSaveJob(user.id, jobId);
      setSavedIds((current) => { const next = new Set(current); if (isSaved) next.add(jobId); else next.delete(jobId); return next; });
      if (tab === "saved" && !isSaved) setJobs((current) => current.filter((job) => job.id !== jobId));
    } catch { toast({ variant: "destructive", title: "Couldn't update saved job" }); } finally { setSaving(false); }
  };
  const saveJob = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try { await createHireJob(user, { ...jobForm, images: jobForm.imageUrl ? [jobForm.imageUrl] : [] }); toast({ title: "Job posted", description: "Local professionals can now apply." }); setJobForm(BLANK_JOB); setTab("posts"); }
    catch (error) { toast({ variant: "destructive", title: "Couldn't post job", description: error.message || "Please try again." }); } finally { setSaving(false); }
  };
  const submitApplication = async (event) => {
    event.preventDefault();
    if (saving || !selectedJob) return;
    setSaving(true);
    try { await applyToHireJob(user, selectedJob.id, applyForm); toast({ title: "Application sent", description: "The job poster will be notified." }); setSelectedJob(null); }
    catch { toast({ variant: "destructive", title: "Couldn't send application" }); } finally { setSaving(false); }
  };
  const hire = async (job, application) => {
    if (saving || !window.confirm(`Hire ${application.worker_name || "this applicant"}?`)) return;
    setSaving(true);
    try { await hireApplicant(job, application); toast({ title: "Applicant hired", description: "They've been notified." }); load(); }
    catch { toast({ variant: "destructive", title: "Couldn't hire applicant" }); } finally { setSaving(false); }
  };
  const openMessages = async (job, recipientId, recipientName) => {
    setMessageTarget({ job, recipientId, recipientName });
    setMessageBody("");
    try { setMessages(await listHireMessages(user.id, job.id)); } catch { setMessages([]); }
  };
  const submitMessage = async (event) => {
    event.preventDefault();
    if (saving || !messageTarget || !messageBody.trim()) return;
    setSaving(true);
    try {
      const message = await sendHireMessage(user, { hireJobId: messageTarget.job.id, recipientId: messageTarget.recipientId, body: messageBody });
      setMessages((current) => [...current, message]);
      setMessageBody("");
    } catch { toast({ variant: "destructive", title: "Couldn't send message" }); } finally { setSaving(false); }
  };


  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading Hire" />;
  const tabs = [
    ["browse", "Browse"],
    ["saved", "Saved"],
    ["post", "Post a job"],
    ["posts", "My posts"],
    ["applications", "Applications"],
  ];

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Grow"
        title="Hire workers"
        subtitle="Post hauls and gigs, or apply to work — find local help for your service business."
      />
      {betaBadgeLabel() && (
        <div className="titan-surface mb-5 p-4 flex justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">{betaBadgeLabel()}</p>
            <p className="text-xs text-muted-foreground mt-1">Post jobs and connect with local professionals at no cost.</p>
          </div>
          <span className="text-xs font-medium text-primary whitespace-nowrap">No fees</span>
        </div>
      )}
      <div className="flex overflow-x-auto gap-1 mb-6 border-b border-border" role="tablist" aria-label="Hire sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors focus-ring ${
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "browse" && (
        <>
          <div className="titan-surface p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search jobs" aria-label="Search jobs" className={`${fieldClass} pl-9`} />
            </div>
            <select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)} className={fieldClass} aria-label="Category">
              <option value="All">All categories</option>
              {SERVICE_CATEGORIES.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select value={filters.state} onChange={(e) => updateFilter("state", e.target.value)} className={fieldClass} aria-label="State">
              <option value="">All states</option>
              {US_STATES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
          {loading ? <PageLoader variant="list" label="Loading jobs" /> : jobs.length ? (
            <div className="grid md:grid-cols-2 gap-4">{jobs.map((job) => <JobCard key={job.id} job={job} saved={savedIds.has(job.id)} onSave={saveToggle} onApply={openApply} />)}</div>
          ) : (
            <EmptyState icon={BriefcaseBusiness} title="No jobs found" description="Try broadening your search or check back soon." />
          )}
        </>
      )}
      {tab === "saved" && (loading ? <PageLoader variant="list" label="Loading saved jobs" /> : jobs.length ? (
        <div className="grid md:grid-cols-2 gap-4">{jobs.map((job) => <JobCard key={job.id} job={job} saved onSave={saveToggle} onApply={openApply} />)}</div>
      ) : (
        <EmptyState icon={BriefcaseBusiness} title="No saved jobs" description="Save jobs from Browse to revisit them here." onAction={() => setTab("browse")} actionLabel="Browse jobs" />
      ))}
      {tab === "post" && (
        <form onSubmit={saveJob} className="titan-surface p-5 md:p-7 max-w-3xl">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Job title" value={jobForm.title} onChange={(e) => setJobForm((x) => ({ ...x, title: e.target.value }))} required />
            <FormField label="Category"><select value={jobForm.category} onChange={(e) => setJobForm((x) => ({ ...x, category: e.target.value }))} className={fieldClass}>{SERVICE_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></FormField>
          </div>
          <FormField label="Description" className="mt-4"><Textarea required rows={5} value={jobForm.description} onChange={(e) => setJobForm((x) => ({ ...x, description: e.target.value }))} className={fieldClass} /></FormField>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <FormField label="City" value={jobForm.city} onChange={(e) => setJobForm((x) => ({ ...x, city: e.target.value }))} />
            <FormField label="State"><select value={jobForm.state} onChange={(e) => setJobForm((x) => ({ ...x, state: e.target.value }))} className={fieldClass}><option value="">Select state</option>{US_STATES.map((value) => <option key={value}>{value}</option>)}</select></FormField>
            <FormField label="Minimum budget"><Input type="number" min="0" value={jobForm.budget_min} onChange={(e) => setJobForm((x) => ({ ...x, budget_min: e.target.value }))} className={fieldClass} /></FormField>
            <FormField label="Maximum budget"><Input type="number" min="0" value={jobForm.budget_max} onChange={(e) => setJobForm((x) => ({ ...x, budget_max: e.target.value }))} className={fieldClass} /></FormField>
            <FormField label="Deadline"><Input type="date" value={jobForm.deadline} onChange={(e) => setJobForm((x) => ({ ...x, deadline: e.target.value }))} className={fieldClass} /></FormField>
            <FormField label="Image URL" hint="Optional"><Input type="url" placeholder="https://..." value={jobForm.imageUrl} onChange={(e) => setJobForm((x) => ({ ...x, imageUrl: e.target.value }))} className={fieldClass} /></FormField>
          </div>
          <div className="flex flex-wrap gap-5 mt-4 text-sm">
            <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={jobForm.is_same_day} onChange={(e) => setJobForm((x) => ({ ...x, is_same_day: e.target.checked }))} className="accent-primary" />Need service same day</label>
            <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={jobForm.is_urgent} onChange={(e) => setJobForm((x) => ({ ...x, is_urgent: e.target.checked }))} className="accent-primary" />Urgent request</label>
          </div>
          <Button disabled={saving} type="submit" className="w-full mt-5">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post job"}</Button>
        </form>
      )}
      {tab === "posts" && (loading ? <PageLoader variant="list" label="Loading your posts" /> : jobs.length ? (
        <div className="space-y-4">{jobs.map((job) => (
          <section key={job.id} className="titan-surface p-5">
            <div className="flex justify-between gap-3">
              <div><h2 className="font-semibold text-foreground">{job.title}</h2><p className="text-xs text-muted-foreground mt-1">{job.category} · {formatBudget(job)}</p></div>
              <span className={`text-xs px-2 py-1 rounded-md h-fit ${job.status === "hired" ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>{job.status}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Applications ({applicants[job.id]?.length || 0})</p>
              {applicants[job.id]?.length ? applicants[job.id].map((app) => (
                <div key={app.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-t border-border first:border-0">
                  <div className="flex-1">
                    <p className="text-sm text-foreground flex items-center gap-1"><UserRound className="w-3 h-3 text-muted-foreground" />{app.worker_name || "Applicant"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{app.message || "No message provided"}{app.bid_amount ? ` · Bid: $${app.bid_amount}` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => openMessages(job, app.worker_id, app.worker_name || "Applicant")} variant="outline" size="sm"><MessageCircle className="w-4 h-4 mr-1" />Message</Button>
                    {app.status === "accepted" ? <span className="text-xs text-success flex items-center gap-1"><Check className="w-3 h-3" />Hired</span> : job.status === "open" && <Button onClick={() => hire(job, app)} disabled={saving} size="sm">Hire</Button>}
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">No applications yet.</p>}
              {job.status === "hired" && job.hired_worker_id && <div className="mt-4"><ReviewForm revieweeId={job.hired_worker_id} reviewerRole="customer" hireJobId={job.id} /></div>}
            </div>
          </section>
        ))}</div>
      ) : (
        <EmptyState icon={BriefcaseBusiness} title="No jobs posted" description="Post a job to find the right local professional." onAction={() => setTab("post")} actionLabel="Post a job" />
      ))}
      {tab === "applications" && (loading ? <PageLoader variant="list" label="Loading applications" /> : applications.length ? (
        <div className="space-y-3">{applications.map((app) => {
          const job = jobById[app.hire_job_id];
          return (
            <article key={app.id} className="titan-surface p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">{job?.title || app.hire_job_title || "Job application"}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{app.message || "Application submitted"}{app.bid_amount ? ` · Bid: $${app.bid_amount}` : ""}</p>
                </div>
                <span className={`text-xs h-fit px-2 py-1 rounded-md ${app.status === "accepted" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{app.status}</span>
              </div>
              {job && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => openMessages(job, job.customer_id, job.customer_name || "Customer")} variant="outline"><MessageCircle className="w-4 h-4 mr-2" />Message customer</Button>
                  {app.status === "accepted" && <ReviewForm revieweeId={job.customer_id} reviewerRole="worker" hireJobId={job.id} />}
                </div>
              )}
            </article>
          );
        })}</div>
      ) : (
        <EmptyState icon={BriefcaseBusiness} title="No applications yet" description="Browse open jobs to find your next opportunity." onAction={() => setTab("browse")} actionLabel="Browse jobs" />
      ))}

      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-lg">
          {selectedJob && (
            <>
              <DialogHeader><DialogTitle>Apply to {selectedJob.title}</DialogTitle></DialogHeader>
              <form onSubmit={submitApplication} className="space-y-4">
                <FormField label="Message"><Textarea required rows={4} value={applyForm.message} onChange={(e) => setApplyForm((x) => ({ ...x, message: e.target.value }))} placeholder="Introduce yourself and describe your experience." className={fieldClass} /></FormField>
                <FormField label="Your bid (optional)"><Input type="number" min="0" value={applyForm.bid_amount} onChange={(e) => setApplyForm((x) => ({ ...x, bid_amount: e.target.value }))} className={fieldClass} /></FormField>
                <Button disabled={saving} type="submit" className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send application</>}</Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!messageTarget} onOpenChange={(open) => !open && setMessageTarget(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-lg">
          {messageTarget && (
            <>
              <DialogHeader><DialogTitle>Message {messageTarget.recipientName}</DialogTitle></DialogHeader>
              <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                {messages.filter((message) => message.sender_id === user.id || message.sender_id === messageTarget.recipientId).map((message) => (
                  <div key={message.id} className={`rounded-md p-3 text-sm ${message.sender_id === user.id ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}><p className="text-foreground">{message.body}</p></div>
                ))}
              </div>
              <form onSubmit={submitMessage} className="flex gap-2 pt-2">
                <Textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Write a message…" className={fieldClass} rows={2} aria-label="Message" />
                <Button type="submit" disabled={saving || !messageBody.trim()} className="self-end" aria-label="Send"><Send className="w-4 h-4" /></Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
