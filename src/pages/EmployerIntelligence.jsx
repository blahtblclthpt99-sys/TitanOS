import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Building2, ExternalLink, ShieldCheck, Star } from "lucide-react";
import { Link } from "react-router";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import PageLoader from "@/components/shared/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NativeSelect from "@/components/shared/NativeSelect";
import { toast } from "@/components/ui/use-toast";
import { getJobMatches } from "@/lib/jobMatchApi";
import { assessOpportunityRisk, buildEmployerSummary, evaluateAlerts, employerKey } from "@/lib/employerIntelligence";

const SAVED_KEY = "titanos_saved_employers_v1";
const ALERT_KEY = "titanos_job_alerts_v1";

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; }
}
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export default function EmployerIntelligence() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(() => readJson(SAVED_KEY, []));
  const [alerts, setAlerts] = useState(() => readJson(ALERT_KEY, []));
  const [alertForm, setAlertForm] = useState({ query: "", location: "", minMatch: 0, source: "all" });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const result = await getJobMatches({ includeExternal: true });
        if (alive) setJobs(result.matches || []);
      } catch (error) {
        toast({ variant: "destructive", title: "Couldn't load employer intelligence", description: error.message || "Please try again." });
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const employers = useMemo(() => buildEmployerSummary(jobs).filter((company) => !query || `${company.name} ${company.city} ${company.state}`.toLowerCase().includes(query.toLowerCase())), [jobs, query]);
  const alertResults = useMemo(() => evaluateAlerts(jobs, alerts), [jobs, alerts]);

  const toggleSaved = (company) => {
    const next = saved.includes(company.key) ? saved.filter((key) => key !== company.key) : [...saved, company.key];
    setSaved(next); writeJson(SAVED_KEY, next);
  };

  const addAlert = (event) => {
    event.preventDefault();
    const rule = { id: `alert_${Date.now()}`, ...alertForm, minMatch: Number(alertForm.minMatch || 0) };
    const next = [rule, ...alerts].slice(0, 20);
    setAlerts(next); writeJson(ALERT_KEY, next);
    setAlertForm({ query: "", location: "", minMatch: 0, source: "all" });
    toast({ title: "Job alert saved", description: "TitanOS will evaluate this rule whenever the job feed refreshes." });
  };

  if (loading) return <PageLoader variant="list" label="Checking employers and job alerts" />;

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader eyebrow="Career" title="Employer intelligence & alerts" subtitle="Evaluate employer context, review risk signals, save companies and create transparent job-alert rules before you apply." />

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="titan-surface p-5 space-y-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Employer research</h2><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or location" className="max-w-xs" /></div>
          {employers.length === 0 ? <EmptyState icon={Building2} title="No employer records in current matches" description="Employer intelligence appears as your TitanOS and approved external job feeds provide listings." /> : (
            <div className="space-y-3">
              {employers.map((company) => (
                <article key={company.key} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-semibold text-foreground">{company.name}</h3><p className="text-xs text-muted-foreground">{[company.city, company.state].filter(Boolean).join(", ") || "Location not provided"} · {company.openListings} listing{company.openListings === 1 ? "" : "s"}</p></div>
                    <Button type="button" size="sm" variant="outline" onClick={() => toggleSaved(company)}><Star className={`mr-1 h-4 w-4 ${saved.includes(company.key) ? "fill-current" : ""}`} />{saved.includes(company.key) ? "Saved" : "Save"}</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-muted px-2 py-1">Sources: {company.sources.join(", ") || "Unknown"}</span><span className={`rounded-full px-2 py-1 ${company.riskLevel === "low" ? "bg-success/10 text-success" : company.riskLevel === "high" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>{company.riskLevel === "low" ? "No obvious listing risk" : company.riskLevel === "high" ? "High-risk signals" : "Review signals"}</span></div>
                  {company.riskSignals.length ? <div className="rounded-md border border-warning/30 bg-warning/5 p-3"><p className="text-xs font-semibold">Signals to verify</p>{company.riskSignals.slice(0, 5).map((signal) => <p key={signal} className="mt-1 text-xs text-muted-foreground">• {signal}</p>)}</div> : <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" />No obvious scam-language pattern detected in current listings. Independent verification is still recommended.</p>}
                  <div className="space-y-2">{company.jobs.slice(0, 3).map((job) => { const risk = assessOpportunityRisk(job); const url = job.source_url || job.match?.source_url; return <div key={`${employerKey(job)}-${job.id}`} className="flex items-center justify-between gap-3 text-sm"><div className="min-w-0"><p className="truncate font-medium">{job.title || "Job"}</p><p className="text-xs text-muted-foreground">Risk: {risk.level}</p></div>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary"><ExternalLink className="h-4 w-4" /></a> : null}</div>; })}</div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <form onSubmit={addAlert} className="titan-surface p-5 space-y-3">
            <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /><h2 className="font-semibold">Create job alert</h2></div>
            <Input value={alertForm.query} onChange={(e) => setAlertForm((f) => ({ ...f, query: e.target.value }))} placeholder="Keyword, title or company" />
            <Input value={alertForm.location} onChange={(e) => setAlertForm((f) => ({ ...f, location: e.target.value }))} placeholder="City or state" />
            <Input type="number" min="0" max="100" value={alertForm.minMatch} onChange={(e) => setAlertForm((f) => ({ ...f, minMatch: e.target.value }))} placeholder="Minimum match %" />
            <NativeSelect value={alertForm.source} onChange={(e) => setAlertForm((f) => ({ ...f, source: e.target.value }))}><option value="all">All sources</option><option value="titan">TitanOS only</option><option value="external">External sources only</option></NativeSelect>
            <Button type="submit" className="w-full">Save alert</Button>
            <p className="text-[11px] text-muted-foreground">Alert rules are user-defined filters. They do not guarantee job availability or employer legitimacy.</p>
          </form>

          <section className="titan-surface p-5 space-y-3">
            <h2 className="font-semibold">Saved alerts</h2>
            {alertResults.length === 0 ? <p className="text-sm text-muted-foreground">No alerts yet.</p> : alertResults.map((alert) => <div key={alert.id} className="rounded-md border border-border p-3"><p className="text-sm font-medium">{alert.query || "Any role"}{alert.location ? ` · ${alert.location}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{alert.matches.length} current match{alert.matches.length === 1 ? "" : "es"} · minimum {alert.minMatch || 0}%</p><Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => { const next = alerts.filter((item) => item.id !== alert.id); setAlerts(next); writeJson(ALERT_KEY, next); }}>Delete alert</Button></div>)}
          </section>

          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs text-muted-foreground"><AlertTriangle className="mb-2 h-4 w-4 text-warning" />TitanOS risk indicators are screening aids, not factual accusations about an employer. Verify company identity, recruiter identity, application domains, and requests for money or sensitive data independently.</div>
          <Button asChild variant="outline" className="w-full"><Link to="/career/search">Back to Job Search Command Center</Link></Button>
        </aside>
      </section>
    </PageShell>
  );
}
