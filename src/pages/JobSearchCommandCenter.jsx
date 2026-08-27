import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BookmarkPlus, Building2, ExternalLink, FileText, Filter, MapPin, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NativeSelect from "@/components/shared/NativeSelect";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getJobMatches, jobMatchSourceLabel, isExternalJobMatch } from "@/lib/jobMatchApi";
import { setMyJobMatchInteraction } from "@/lib/jobMatchInteractionsApi";
import {
  annualizePay,
  buildResumeLink,
  filterJobSearch,
  loadSavedSearches,
  removeSavedSearch,
  safeExternalJobUrl,
  saveSearch,
  sortJobSearch,
  sourceTrust,
} from "@/lib/jobSearchCommand";

const DEFAULT_FILTERS = { query: "", company: "", location: "", source: "all", minMatch: 0, minAnnual: 0, sort: "match" };

function currency(value) {
  return value == null ? "Pay not listed" : `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)}/yr est.`;
}

export default function JobSearchCommandCenter() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [savedSearches, setSavedSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setSavedSearches(user?.id ? loadSavedSearches(user.id) : []);
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getJobMatches({ includeExternal: true });
      setJobs(result.matches || []);
    } catch {
      toast({ variant: "destructive", title: "Couldn't load job search", description: "The opportunity feed is unavailable right now. Please try again." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => sortJobSearch(filterJobSearch(jobs, filters), filters.sort), [jobs, filters]);
  const nativeCount = jobs.filter((job) => !isExternalJobMatch(job)).length;
  const externalCount = jobs.length - nativeCount;

  const patch = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const track = async (job, state) => {
    if (!user?.id || busyId) return;
    setBusyId(job.id);
    try {
      await setMyJobMatchInteraction(user.id, job, state);
      setJobs((rows) => rows.map((row) => row.id === job.id ? { ...row, interaction_state: state } : row));
      toast({ title: state === "saved" ? "Saved to career search" : "Added to Applications" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't update opportunity", description: "Your change was not saved. Please try again." });
    } finally {
      setBusyId(null);
    }
  };

  const rememberSearch = () => {
    if (!user?.id) return;
    setSavedSearches(saveSearch(user.id, filters));
    toast({ title: "Search saved for this account on this device" });
  };

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader eyebrow="Career" title="Job Search Command Center" subtitle="Search traceable TitanOS and approved external opportunities, compare fit and pay, and move directly into resume and application workflows." />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Available matches</p><p className="mt-1 text-2xl font-bold">{jobs.length}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">TitanOS native</p><p className="mt-1 text-2xl font-bold">{nativeCount}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">External sourced</p><p className="mt-1 text-2xl font-bold">{externalCount}</p></div>
      </section>

      <section className="titan-surface p-5 space-y-4" aria-labelledby="job-search-filters">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 id="job-search-filters" className="font-semibold">Search & filters</h2><p className="mt-1 text-xs text-muted-foreground">Pay is normalized to an annual estimate only when the listing declares a usable pay period.</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={rememberSearch} disabled={!user?.id}><BookmarkPlus className="mr-2 h-4 w-4" />Save search</Button><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1"><span className="text-xs font-semibold">Keywords</span><Input value={filters.query} onChange={(e) => patch("query", e.target.value)} placeholder="driver, warehouse, technician" /></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Company</span><Input value={filters.company} onChange={(e) => patch("company", e.target.value)} placeholder="Company name" /></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Location</span><Input value={filters.location} onChange={(e) => patch("location", e.target.value)} placeholder="City or state" /></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Source</span><NativeSelect value={filters.source} onChange={(e) => patch("source", e.target.value)}><option value="all">All sources</option><option value="native">TitanOS native</option><option value="external">External</option></NativeSelect></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Minimum match</span><NativeSelect value={filters.minMatch} onChange={(e) => patch("minMatch", Number(e.target.value))}><option value="0">Any match</option><option value="60">60%+</option><option value="75">75%+</option><option value="90">90%+</option></NativeSelect></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Minimum annual pay</span><NativeSelect value={filters.minAnnual} onChange={(e) => patch("minAnnual", Number(e.target.value))}><option value="0">Any listed pay</option><option value="30000">$30,000+</option><option value="40000">$40,000+</option><option value="50000">$50,000+</option><option value="60000">$60,000+</option><option value="75000">$75,000+</option><option value="100000">$100,000+</option></NativeSelect></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Sort</span><NativeSelect value={filters.sort} onChange={(e) => patch("sort", e.target.value)}><option value="match">Best match</option><option value="newest">Newest</option><option value="pay">Highest normalized pay</option></NativeSelect></label>
        </div>
      </section>

      {savedSearches.length ? <section className="titan-surface p-4 space-y-2"><h2 className="text-sm font-semibold">Saved searches</h2><div className="flex flex-wrap gap-2">{savedSearches.map((item) => <div key={item.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-background p-1"><button className="px-2 py-1 text-xs font-medium" onClick={() => setFilters({ ...DEFAULT_FILTERS, ...item.filters })}>{item.name}</button><button aria-label={`Delete ${item.name}`} className="p-1 text-muted-foreground hover:text-destructive" onClick={() => setSavedSearches(removeSavedSearch(user?.id, item.id))}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div></section> : null}

      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite"><Filter className="h-4 w-4" />{visible.length} result{visible.length === 1 ? "" : "s"}</div>

      {loading ? <div className="titan-surface p-6 text-sm text-muted-foreground" role="status">Loading opportunities…</div> : visible.length === 0 ? <EmptyState icon={Search} title="No jobs match these filters" description="Broaden the filters or refresh the opportunity feed." actionLabel="Clear filters" onAction={() => setFilters(DEFAULT_FILTERS)} /> : <section className="grid gap-4 lg:grid-cols-2">{visible.map((job) => {
        const trust = sourceTrust(job);
        const company = job.company_name || job.company || job.employer_name || job.source_name || "Employer not listed";
        const annual = annualizePay(job);
        const source = jobMatchSourceLabel(job);
        const originalUrl = isExternalJobMatch(job) ? safeExternalJobUrl(job) : null;
        return <article key={`${job.source || "titan"}-${job.id}`} className="titan-surface p-5 space-y-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-semibold">{job.title || "Opportunity"}</h2><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{company}</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">{Number(job.match?.score || 0)}% match</span></div>
          <div className="flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1"><ShieldCheck className="h-3.5 w-3.5" />{trust.label}</span><span className="rounded-full border border-border px-2 py-1">{source}</span>{(job.city || job.state) ? <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1"><MapPin className="h-3.5 w-3.5" />{[job.city, job.state].filter(Boolean).join(", ")}</span> : null}</div>
          <p className="text-xs text-muted-foreground">{trust.detail}</p>
          <div className="rounded-lg border border-border bg-background p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Compensation comparison</p><p className="mt-1 font-semibold">{currency(annual)}</p>{annual == null ? <p className="mt-1 text-xs text-muted-foreground">TitanOS will not guess missing salary data.</p> : null}</div>
          {job.description ? <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{job.description}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" disabled={busyId === job.id} onClick={() => track(job, "saved")}>Save</Button><Button variant="outline" disabled={busyId === job.id} onClick={() => track(job, "applied")}>Track application</Button><Button asChild><Link to={buildResumeLink(job)}><FileText className="mr-2 h-4 w-4" />Tailor resume</Link></Button>{originalUrl ? <Button asChild variant="outline"><a href={originalUrl} target="_blank" rel="noopener noreferrer">Original listing<ExternalLink className="ml-2 h-4 w-4" /></a></Button> : isExternalJobMatch(job) ? <Button variant="outline" disabled>Source link unavailable</Button> : <Button asChild variant="outline"><Link to={`/hire?tab=browse&job=${encodeURIComponent(job.id)}`}>Open Titan job</Link></Button>}</div>
        </article>;
      })}</section>}

      <p className="text-xs text-muted-foreground">Saved searches are private to this signed-in account on this device. Search ranking and pay normalization are career-assistance tools for the seeker, not employer hiring decisions, eligibility guarantees, or guarantees that an external listing remains open.</p>
    </PageShell>
  );
}
