import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, Loader2, MapPin, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getJobMatches, isExternalJobMatch, jobMatchSourceLabel } from "@/lib/jobMatchApi";
import { getMyJobMatchPreferences, saveMyJobMatchPreferences } from "@/lib/jobMatchProfileApi";
import { getMyDriverProfile, saveMyDriverProfile } from "@/lib/driverProfilesApi";

function csv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function csvText(values) {
  return Array.isArray(values) ? values.join(", ") : "";
}

function MatchCard({ job }) {
  const external = isExternalJobMatch(job);
  const score = Number(job.match?.score || 0);
  const reasons = Array.isArray(job.match?.reasons) ? job.match.reasons : [];
  const blockers = Array.isArray(job.match?.blockers) ? job.match.blockers : [];
  const source = jobMatchSourceLabel(job);
  const destination = external ? job.source_url || job.match?.source_url : `/hire?tab=browse&job=${encodeURIComponent(job.id)}`;

  return (
    <article className="titan-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground">{job.title || "Job"}</h2>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              {score}% match
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Source: {source}</p>
        </div>
        {external ? <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
      </div>

      {job.description ? <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{job.description}</p> : null}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {(job.city || job.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{[job.city, job.state].filter(Boolean).join(", ")}</span>}
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
          <p className="text-xs font-semibold text-warning">Requirements to check</p>
          {blockers.slice(0, 3).map((item) => <p key={item} className="mt-1 text-xs text-muted-foreground">{item}</p>)}
        </div>
      ) : null}

      {external ? (
        <a href={destination} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-ring">
          View on {source}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : (
        <Button asChild className="min-h-[44px] w-full"><Link to={destination}>Open in Titan Hire</Link></Button>
      )}
    </article>
  );
}

export default function JobMatches() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState([]);
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
  });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [driver, prefs, result] = await Promise.all([
        getMyDriverProfile(user.id),
        getMyJobMatchPreferences(user.id).catch(() => null),
        getJobMatches({ includeExternal: true }),
      ]);
      setForm({
        skills: csvText(driver?.skills || prefs?.skills),
        certifications: csvText(driver?.certifications || prefs?.certifications),
        interests: csvText(prefs?.job_interests),
        radius: Number(prefs?.work_radius_miles || 50),
        desiredPay: Number(prefs?.desired_pay_min || 0),
        payType: prefs?.desired_pay_type || "hourly",
        schedule: csvText(prefs?.preferred_schedule),
        externalConsent: Boolean(prefs?.external_job_search_consent),
      });
      setMatches(result.matches || []);
      setStatus(result);
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't load job matches", description: error.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const hasQualifications = useMemo(() => Boolean(csv(form.skills).length || csv(form.interests).length), [form.skills, form.interests]);

  const save = async (event) => {
    event.preventDefault();
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      await saveMyDriverProfile(user.id, {
        skills: csv(form.skills),
        certifications: csv(form.certifications),
      });
      await saveMyJobMatchPreferences(user.id, {
        job_interests: csv(form.interests),
        work_radius_miles: Number(form.radius),
        desired_pay_min: Number(form.desiredPay),
        desired_pay_type: form.payType,
        preferred_schedule: csv(form.schedule),
        external_job_search_consent: Boolean(form.externalConsent),
      });
      toast({ title: "Job matching updated", description: "Titan will use these qualifications and preferences for your matches." });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't save matching profile", description: error.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader eyebrow="Work" title="Matches for you" subtitle="Titan ranks work from your skills first, then can search approved external providers when you allow it." />

      <section className="titan-surface p-5" aria-labelledby="match-profile-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="match-profile-heading" className="font-semibold text-foreground">Your matching profile</h2>
            <p className="mt-1 text-xs text-muted-foreground">Skills and certifications are part of your professional profile. Pay, radius, schedule and external-search consent stay private to your account.</p>
          </div>
          <Button type="button" variant="outline" onClick={load} disabled={loading} className="min-h-[44px] gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</Button>
        </div>

        <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Work skills</span><Input value={form.skills} onChange={(e) => setForm((old) => ({ ...old, skills: e.target.value }))} placeholder="delivery, box truck, forklift" aria-describedby="skills-help" /><span id="skills-help" className="block text-[11px] text-muted-foreground">Comma-separated. These drive the strongest match signal.</span></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Licenses & certifications</span><Input value={form.certifications} onChange={(e) => setForm((old) => ({ ...old, certifications: e.target.value }))} placeholder="CDL A, DOT medical card, forklift" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Job interests</span><Input value={form.interests} onChange={(e) => setForm((old) => ({ ...old, interests: e.target.value }))} placeholder="courier, warehouse, maintenance" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Preferred schedule</span><Input value={form.schedule} onChange={(e) => setForm((old) => ({ ...old, schedule: e.target.value }))} placeholder="weekday, day, weekend" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Work radius (miles)</span><Input type="number" min="1" max="500" value={form.radius} onChange={(e) => setForm((old) => ({ ...old, radius: e.target.value }))} /></label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Minimum desired pay</span><Input type="number" min="0" step="0.01" value={form.desiredPay} onChange={(e) => setForm((old) => ({ ...old, desiredPay: e.target.value }))} /></label>
            <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Pay type</span><select value={form.payType} onChange={(e) => setForm((old) => ({ ...old, payType: e.target.value }))} className="min-h-[40px] rounded-md border border-border bg-background px-3 text-sm text-foreground"><option value="hourly">Hourly</option><option value="salary">Salary</option><option value="flat">Flat</option><option value="any">Any</option></select></label>
          </div>

          <label className="sm:col-span-2 flex min-h-[56px] cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <input type="checkbox" checked={form.externalConsent} onChange={(e) => setForm((old) => ({ ...old, externalConsent: e.target.checked }))} className="mt-1 h-5 w-5" />
            <span><span className="block text-sm font-semibold text-foreground">Search approved external job providers when Titan's own board is thin</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">This permission is only for searching. Titan will show the source and will never apply to an external job without you choosing to continue.</span></span>
          </label>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving} className="min-h-[44px] gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}Save & find matches</Button>
            {!hasQualifications && <span className="text-xs text-warning">Add at least one skill or job interest to get useful matches.</span>}
          </div>
        </form>
      </section>

      {loading ? (
        <div className="titan-surface flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Finding work that fits you…</div>
      ) : status.needsProfile ? (
        <EmptyState icon={BriefcaseBusiness} title="Build your work profile" description="Add your work skills so Titan can start matching you to jobs." actionLabel="Open Driver Hub" onAction={() => { window.location.href = "/driver"; }} />
      ) : status.needsSkills ? (
        <EmptyState icon={Sparkles} title="Tell Titan what you can do" description="Add skills or job interests above, then save to start matching." />
      ) : matches.length ? (
        <section aria-labelledby="matches-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 id="matches-heading" className="text-lg font-semibold text-foreground">Best matches</h2><p className="text-xs text-muted-foreground">Titan jobs are ranked first. External listings always show their provider.</p></div><span className="text-xs text-muted-foreground">{matches.length} result{matches.length === 1 ? "" : "s"}</span></div>
          <div className="grid gap-4 md:grid-cols-2">{matches.map((job) => <MatchCard key={job.id} job={job} />)}</div>
        </section>
      ) : (
        <EmptyState icon={BriefcaseBusiness} title="No strong matches yet" description={status.external?.reason === "provider_not_configured" && form.externalConsent ? "Titan searched its own board. External job search is not connected yet, so no outside listings were claimed." : "Titan did not find a strong current match. Keep your skills and availability up to date and check again."} />
      )}
    </PageShell>
  );
}
