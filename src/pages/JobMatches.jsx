import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Bookmark, BriefcaseBusiness, CheckCircle2, EyeOff, Loader2, MapPin, MessageCircle, Navigation, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import EngagementSignal from "@/components/trust/EngagementSignal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getJobMatches, isExternalJobMatch, jobMatchSourceLabel } from "@/lib/jobMatchApi";
import { getMyJobMatchPreferences, saveMyJobMatchPreferences } from "@/lib/jobMatchProfileApi";
import { clearMyJobMatchInteraction, setMyJobMatchInteraction } from "@/lib/jobMatchInteractionsApi";
import { getMyEmploymentProfile, saveMyEmploymentProfile } from "@/lib/employmentProfilesApi";
import { applyToHireJob, toggleSaveJob } from "@/lib/hireApi";

function csv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function csvText(values) {
  return Array.isArray(values) ? values.join(", ") : "";
}

function MatchCard({ job, onAction, busy }) {
  const [showEmployerEngagement, setShowEmployerEngagement] = useState(false);
  const external = isExternalJobMatch(job);
  const score = Number(job.match?.score || 0);
  const reasons = Array.isArray(job.match?.reasons) ? job.match.reasons : [];
  const blockers = Array.isArray(job.match?.blockers) ? job.match.blockers : [];
  const source = jobMatchSourceLabel(job);
  const state = job.interaction_state || null;
  const ownerId = String(job.customer_id || job.created_by_id || "");
  const externalDestination = job.source_url || job.match?.source_url || "";

  return (
    <article className="titan-surface space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground">{job.title || "Job"}</h2>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Employee Opportunity</span>
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">{score}% match</span>
            {state && <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{state}</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Source: {source}</p>
        </div>
        {external ? <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
      </div>

      {job.description ? <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{job.description}</p> : null}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {(job.city || job.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{[job.city, job.state].filter(Boolean).join(", ")}</span>}
        {job.distance_mi != null && <span>{Number(job.distance_mi).toFixed(1)} mi away</span>}
        {(job.budget_min || job.budget_max) && <span>{job.budget_min ? `From $${Number(job.budget_min).toLocaleString()}` : ""}{job.budget_min && job.budget_max ? " · " : ""}{job.budget_max ? `Up to $${Number(job.budget_max).toLocaleString()}` : ""}</span>}
      </div>

      {reasons.length ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Why Titan matched this</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground/90">
            {reasons.slice(0, 4).map((reason) => <li key={reason} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" /><span>{reason}</span></li>)}
          </ul>
        </div>
      ) : null}

      {blockers.length ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p className="text-xs font-semibold text-warning">Profile information to complete</p>
          {blockers.slice(0, 3).map((item) => <p key={item} className="mt-1 text-xs text-muted-foreground">{item}</p>)}
        </div>
      ) : null}

      {!external && ownerId ? (
        <div>
          <Button type="button" variant="ghost" size="sm" className="gap-2 px-2" onClick={() => setShowEmployerEngagement((value) => !value)}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />{showEmployerEngagement ? "Hide employer Engagement" : "View employer Engagement"}
          </Button>
          {showEmployerEngagement ? (
            <div className="mt-2">
              <EngagementSignal subjectUserId={ownerId} opportunityId={job.id} compact />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onAction(job, "save")} className="gap-2">
          <Bookmark className={`h-4 w-4 ${state === "saved" ? "fill-current" : ""}`} aria-hidden="true" />{state === "saved" ? "Saved" : "Save"}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => onAction(job, "ignore")} className="gap-2"><EyeOff className="h-4 w-4" aria-hidden="true" />Ignore</Button>
      </div>

      {external ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <a href={externalDestination} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-ring">View on {source}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
          <Button type="button" variant="outline" disabled={busy || state === "applied"} onClick={() => onAction(job, "applied")}>{state === "applied" ? "Applied" : "Mark applied"}</Button>
        </div>
      ) : (
        <Button type="button" disabled={busy || state === "applied"} className="min-h-[44px] w-full" onClick={() => onAction(job, "interest")}>
          {state === "applied" ? "Interest sent" : "I'm interested"}
        </Button>
      )}
    </article>
  );
}

export default function JobMatches() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(null);
  const [matches, setMatches] = useState([]);
  const [view, setView] = useState("all");
  const [status, setStatus] = useState({ needsProfile: false, needsSkills: false, external: {} });
  const [form, setForm] = useState({
    skills: "",
    certifications: "",
    interests: "",
    radius: 50,
    desiredPay: 0,
    payType: "hourly",
    schedule: "",
    externalConsent: false,
    searchLat: null,
    searchLng: null,
  });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [profile, prefs, result] = await Promise.all([
        getMyEmploymentProfile(user.id).catch(() => null),
        getMyJobMatchPreferences(user.id).catch(() => null),
        getJobMatches({ includeExternal: true }),
      ]);
      setForm({
        skills: csvText(profile?.skills),
        certifications: csvText(profile?.qualifications || profile?.certifications),
        interests: csvText(prefs?.job_interests),
        radius: Number(prefs?.work_radius_miles || 50),
        desiredPay: Number(prefs?.desired_pay_min || 0),
        payType: prefs?.desired_pay_type || "hourly",
        schedule: csvText(prefs?.preferred_schedule),
        externalConsent: Boolean(prefs?.external_job_search_consent),
        searchLat: prefs?.search_lat ?? null,
        searchLng: prefs?.search_lng ?? null,
      });
      setMatches(result.matches || []);
      setStatus(result);
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't load available jobs", description: error.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const hasQualifications = useMemo(() => Boolean(csv(form.skills).length || csv(form.interests).length), [form.skills, form.interests]);
  const hasPreciseOrigin = form.searchLat != null && form.searchLng != null;
  const matchCounts = useMemo(() => ({
    all: matches.length,
    saved: matches.filter((job) => job.interaction_state === "saved").length,
    applied: matches.filter((job) => job.interaction_state === "applied").length,
  }), [matches]);
  const visibleMatches = useMemo(() => view === "all" ? matches : matches.filter((job) => job.interaction_state === view), [matches, view]);

  const save = async (event) => {
    event.preventDefault();
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      await saveMyEmploymentProfile(user.id, {
        displayName: user.full_name || user.username || user.email?.split("@")[0] || "Titan user",
        skills: csv(form.skills),
        qualifications: csv(form.certifications),
      });
      await saveMyJobMatchPreferences(user.id, {
        job_interests: csv(form.interests),
        work_radius_miles: Number(form.radius),
        desired_pay_min: Number(form.desiredPay),
        desired_pay_type: form.payType,
        preferred_schedule: csv(form.schedule),
        external_job_search_consent: Boolean(form.externalConsent),
        search_lat: form.searchLat,
        search_lng: form.searchLng,
      });
      toast({ title: "Job matching updated", description: "Titan will use these qualifications and private preferences to narrow your employment feed." });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't save matching profile", description: error.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Location is not available on this device" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((old) => ({ ...old, searchLat: position.coords.latitude, searchLng: position.coords.longitude }));
        toast({ title: "Private search origin ready", description: "Save matching preferences to use radius matching. Exact coordinates are never published to employers." });
      },
      () => toast({ variant: "destructive", title: "Location permission was not granted", description: "Titan will keep using general city/state matching." }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const actOnMatch = async (job, action) => {
    if (!user?.id || actionBusy) return;
    setActionBusy(job.id);
    try {
      const external = isExternalJobMatch(job);
      if (action === "ignore") {
        await setMyJobMatchInteraction(user.id, job, "ignored");
        setMatches((rows) => rows.filter((row) => row.id !== job.id));
        toast({ title: "Opportunity hidden", description: "Titan will keep this listing out of your current feed." });
      } else if (action === "save") {
        if (external) {
          if (job.interaction_state === "saved") {
            await clearMyJobMatchInteraction(user.id, job);
            setMatches((rows) => rows.map((row) => row.id === job.id ? { ...row, interaction_state: null } : row));
          } else {
            await setMyJobMatchInteraction(user.id, job, "saved");
            setMatches((rows) => rows.map((row) => row.id === job.id ? { ...row, interaction_state: "saved" } : row));
          }
        } else {
          const saved = await toggleSaveJob(user.id, job.id);
          setMatches((rows) => rows.map((row) => row.id === job.id ? { ...row, interaction_state: saved ? "saved" : null } : row));
        }
      } else if (action === "interest" && !external) {
        await applyToHireJob(user, job.id, { message: "I'm interested in this employment opportunity.", bid_amount: "" });
        setMatches((rows) => rows.map((row) => row.id === job.id ? { ...row, interaction_state: "applied" } : row));
        toast({ title: "Interest sent", description: "The business can now review your Job Profile and respond through Titan." });
      } else if (action === "applied" && external) {
        await setMyJobMatchInteraction(user.id, job, "applied");
        setMatches((rows) => rows.map((row) => row.id === job.id ? { ...row, interaction_state: "applied" } : row));
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't update this opportunity", description: error.message || "Please try again." });
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader eyebrow="Job Seeker" title="Available jobs" subtitle="See employment opportunities immediately. Titan progressively narrows and explains the feed as you add skills, qualifications, location, availability, schedule, and pay preferences." />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{loading ? "Refreshing opportunities…" : `${matches.length} current opportunity${matches.length === 1 ? "" : "ies"}`}</p>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/job-profile">Job Profile</Link></Button>
          <Button type="button" variant="outline" onClick={load} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</Button>
        </div>
      </div>

      {status.discoveryMode === "broad" && !loading ? (
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold text-foreground">You're seeing available employment now</p>
              <p className="mt-1 text-sm text-muted-foreground">This is broad discovery, not a qualification verdict. Add skills or job interests below and Titan will replace broad location ordering with a more precise match.</p>
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="titan-surface flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Finding available employment…</div>
      ) : matches.length ? (
        <section aria-labelledby="matches-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="matches-heading" className="text-lg font-semibold text-foreground">Employment opportunities</h2>
              <p className="text-xs text-muted-foreground">Titan opportunities stay visible based on qualification matching. Engagement is separate and never affects your access to this feed.</p>
            </div>
            <span className="text-xs text-muted-foreground">{visibleMatches.length} shown</span>
          </div>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter job matches">
            {[["all", "All"], ["saved", "Saved"], ["applied", "Interested"]].map(([id, label]) => (
              <Button key={id} type="button" size="sm" variant={view === id ? "default" : "outline"} onClick={() => setView(id)}>{label} ({matchCounts[id]})</Button>
            ))}
          </div>
          {visibleMatches.length ? (
            <div className="grid gap-4 md:grid-cols-2">{visibleMatches.map((job) => <MatchCard key={job.id} job={job} onAction={actOnMatch} busy={actionBusy === job.id} />)}</div>
          ) : (
            <EmptyState icon={BriefcaseBusiness} title={`No ${view} opportunities in this feed`} description={view === "saved" ? "Save a current opportunity and it will appear here." : "Opportunities you intentionally express interest in will appear here while they remain active."} />
          )}
        </section>
      ) : (
        <EmptyState icon={BriefcaseBusiness} title="No current employment opportunities" description={status.external?.reason === "provider_not_configured" && form.externalConsent ? "Titan checked its own employment board. External job search is not connected yet, so no outside listings were claimed." : "No current employment opening is available in this feed. Keep your location and interests current and refresh later."} />
      )}

      <section className="titan-surface p-5" aria-labelledby="match-profile-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="match-profile-heading" className="font-semibold text-foreground">Improve your matches</h2>
            <p className="mt-1 text-xs text-muted-foreground">Skills and qualifications live in your neutral Job Profile. Pay, radius, schedule, precise search origin, and external-search consent stay private.</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/job-profile">Edit full Job Profile</Link></Button>
        </div>

        <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Work skills</span><Input value={form.skills} onChange={(e) => setForm((old) => ({ ...old, skills: e.target.value }))} placeholder="delivery, box truck, forklift" aria-describedby="skills-help" /><span id="skills-help" className="block text-[11px] text-muted-foreground">Comma-separated. These are qualification signals, not reputation signals.</span></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Licenses & qualifications</span><Input value={form.certifications} onChange={(e) => setForm((old) => ({ ...old, certifications: e.target.value }))} placeholder="CDL A, DOT medical card, forklift" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Job interests</span><Input value={form.interests} onChange={(e) => setForm((old) => ({ ...old, interests: e.target.value }))} placeholder="courier, warehouse, maintenance" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Preferred schedule</span><Input value={form.schedule} onChange={(e) => setForm((old) => ({ ...old, schedule: e.target.value }))} placeholder="weekday, day, weekend" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Work radius (miles)</span><Input type="number" min="1" max="500" value={form.radius} onChange={(e) => setForm((old) => ({ ...old, radius: e.target.value }))} /></label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Minimum desired pay</span><Input type="number" min="0" step="0.01" value={form.desiredPay} onChange={(e) => setForm((old) => ({ ...old, desiredPay: e.target.value }))} /></label>
            <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Pay type</span><select value={form.payType} onChange={(e) => setForm((old) => ({ ...old, payType: e.target.value }))} className="min-h-[40px] rounded-md border border-border bg-background px-3 text-sm text-foreground"><option value="hourly">Hourly</option><option value="salary">Salary</option><option value="flat">Flat</option><option value="any">Any</option></select></label>
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
            <Button type="button" variant="outline" onClick={useCurrentLocation} className="gap-2"><Navigation className="h-4 w-4" aria-hidden="true" />Use current location</Button>
            {hasPreciseOrigin && <Button type="button" variant="ghost" onClick={() => setForm((old) => ({ ...old, searchLat: null, searchLng: null }))}>Clear precise location</Button>}
            <span className="text-xs text-muted-foreground">{hasPreciseOrigin ? "Private radius matching ready. Save to apply it." : "General city/state matching stays active until you choose a private search origin."}</span>
          </div>

          <label className="sm:col-span-2 flex min-h-[56px] cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <input type="checkbox" checked={form.externalConsent} onChange={(e) => setForm((old) => ({ ...old, externalConsent: e.target.checked }))} className="mt-1 h-5 w-5" />
            <span><span className="block text-sm font-semibold text-foreground">Search approved external job providers when Titan's employment board is thin</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">This permission is search-only. Titan shows the source and never applies without your action.</span></span>
          </label>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving} className="min-h-[44px] gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}Save & refine jobs</Button>
            {!hasQualifications && <span className="text-xs text-warning">You can browse now; add a skill or job interest for stronger matching.</span>}
          </div>
        </form>
      </section>
    </PageShell>
  );
}
