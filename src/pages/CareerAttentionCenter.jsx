import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, BriefcaseBusiness, CalendarClock, CheckCircle2, Clock3, RefreshCw, Search, UserRoundCheck } from "lucide-react";
import { Link } from "react-router";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getJobMatches } from "@/lib/jobMatchApi";
import { listMyJobMatchInteractions } from "@/lib/jobMatchInteractionsApi";
import { getMyProfessionalProfile } from "@/lib/professionalProfileApi";
import { attentionCounts, buildCareerAttention } from "@/lib/careerAttention";
import { readCareerPreference, writeCareerPreference } from "@/lib/careerPreferenceStorage";

const KIND_META = {
  interview: { icon: CalendarClock, label: "Interview" },
  follow_up: { icon: Clock3, label: "Follow-up" },
  new_match: { icon: Search, label: "New match" },
  expiring_listing: { icon: BriefcaseBusiness, label: "Closing soon" },
  profile: { icon: UserRoundCheck, label: "Career profile" },
};

export default function CareerAttentionCenter() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [interactions, setInteractions] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [reviewedAlerts, setReviewedAlerts] = useState([]);

  useEffect(() => {
    if (!user?.id) {
      setReviewedAlerts([]);
      return;
    }
    setReviewedAlerts(readCareerPreference(user.id, "reviewed-alert-matches", []));
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [pipelineRows, matchResult, professionalProfile] = await Promise.all([
        listMyJobMatchInteractions(user.id),
        getJobMatches({ includeExternal: true }),
        getMyProfessionalProfile(user),
      ]);
      setInteractions(pipelineRows || []);
      setJobs(matchResult.matches || []);
      setProfile(professionalProfile || {});
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't refresh career attention", description: error.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const alerts = useMemo(
    () => user?.id ? readCareerPreference(user.id, "job-alerts", []) : [],
    [user?.id, jobs]
  );
  const items = useMemo(
    () => buildCareerAttention({ interactions, jobs, alerts, profile: profile || {}, seenAlertKeys: reviewedAlerts }),
    [interactions, jobs, alerts, profile, reviewedAlerts]
  );
  const counts = useMemo(() => attentionCounts(items), [items]);

  const markAlertReviewed = (item) => {
    if (!item.alert_key || !user?.id) return;
    const next = [...new Set([item.alert_key, ...reviewedAlerts])].slice(0, 500);
    setReviewedAlerts(next);
    writeCareerPreference(user.id, "reviewed-alert-matches", next);
  };

  if (loading && !profile) return <PageLoader variant="list" label="Checking career priorities" />;

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader eyebrow="Career" title="What needs attention today?" subtitle="A private, user-controlled career inbox for interviews, application follow-ups, saved-search matches, closing listings and profile readiness." />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Needs attention</p><p className="mt-1 text-2xl font-bold">{counts.total}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Urgent</p><p className="mt-1 text-2xl font-bold">{counts.urgent}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Interviews</p><p className="mt-1 text-2xl font-bold">{counts.interviews}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Follow-ups</p><p className="mt-1 text-2xl font-bold">{counts.followUps}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">New matches</p><p className="mt-1 text-2xl font-bold">{counts.newMatches}</p></div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        <Button asChild variant="outline"><Link to="/career/pipeline">Applications</Link></Button>
        <Button asChild variant="outline"><Link to="/career/search">Job Search</Link></Button>
        <Button asChild variant="outline"><Link to="/career/employers">Job Alerts</Link></Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing urgent right now" description="TitanOS did not find an upcoming interview, due follow-up, unseen saved-search match, closing listing or profile-readiness item that needs your attention." />
      ) : (
        <section className="space-y-3" aria-label="Career attention items">
          {items.map((item) => {
            const meta = KIND_META[item.kind] || { icon: BellRing, label: "Career" };
            const Icon = meta.icon;
            return (
              <article key={item.id} className={`titan-surface p-5 ${item.priority === "urgent" ? "border-destructive/35" : item.priority === "high" ? "border-warning/35" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" aria-hidden="true" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{meta.label}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">{item.priority}</span></div>
                    <h2 className="mt-1 font-semibold text-foreground">{item.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm"><Link to={item.link || "/career/pipeline"}>Review</Link></Button>
                      {item.kind === "interview" ? <Button asChild size="sm" variant="outline"><Link to="/assistant?mode=interview">TitanAI prep</Link></Button> : null}
                      {item.kind === "new_match" ? <Button type="button" size="sm" variant="outline" onClick={() => markAlertReviewed(item)}>Mark reviewed</Button> : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <p className="text-xs text-muted-foreground">Career reminders and reviewed-alert state are private to this account on this device. Reminders never submit applications, contact employers, change application stages, or share data automatically.</p>
    </PageShell>
  );
}
