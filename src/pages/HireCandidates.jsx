import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import HireRequestDialog from "@/components/driver/HireRequestDialog";
import { useAuth } from "@/lib/AuthContext";
import { loadOwnedJobCandidateMatches } from "@/lib/employerWorkerMatch";
import { formatBudget, locationLabel } from "@/lib/hireApi";
import { formatDriverRate } from "@/lib/driverDirectoryApi";

export default function HireCandidates() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const jobId = params.get("job") || "";
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hireTarget, setHireTarget] = useState(null);

  useEffect(() => {
    if (!authChecked || !user?.id || !jobId) return;
    let cancelled = false;
    setLoading(true);
    loadOwnedJobCandidateMatches(user.id, jobId)
      .then((result) => {
        if (cancelled) return;
        setJob(result.job);
        setCandidates(result.candidates);
      })
      .catch((error) => {
        if (cancelled) return;
        toast({ variant: "destructive", title: "Candidate matches unavailable", description: error.message || "Please try again." });
        setJob(null);
        setCandidates([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authChecked, user?.id, jobId]);

  if (!authChecked || isLoadingAuth || loading) return <PageLoader variant="list" label="Matching workers" />;

  if (!jobId) {
    return (
      <PageShell maxWidth="lg">
        <EmptyState icon={BriefcaseBusiness} title="Choose one of your jobs" description="Open Hire → My posts and select Find matching workers." actionLabel="Go to My posts" onAction={() => navigate("/hire?tab=posts")} />
      </PageShell>
    );
  }

  if (!job) {
    return (
      <PageShell maxWidth="lg">
        <EmptyState icon={ShieldCheck} title="Candidate matches unavailable" description="This view is limited to the job owner and requires the live Hire board." actionLabel="Back to My posts" onAction={() => navigate("/hire?tab=posts")} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="lg" className="space-y-5">
      <Button type="button" variant="ghost" className="gap-2" onClick={() => navigate("/hire?tab=posts")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to My posts
      </Button>

      <PageHeader
        eyebrow="Hire · Matching"
        title={`Candidates for ${job.title}`}
        subtitle="Ranked from public worker profiles only. Private preferences and 2nd Me consent settings are never exposed to employers."
      />

      <div className="titan-surface p-4 grid gap-2 sm:grid-cols-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium text-foreground">{locationLabel(job.city, job.state) || "Not specified"}</p></div>
        <div><p className="text-xs text-muted-foreground">Pay</p><p className="font-medium text-foreground">{formatBudget(job)}</p></div>
        <div><p className="text-xs text-muted-foreground">Matches</p><p className="font-medium text-foreground">{candidates.length} qualified public profile{candidates.length === 1 ? "" : "s"}</p></div>
      </div>

      {candidates.length ? (
        <div className="space-y-4">
          {candidates.map((driver) => (
            <article key={driver.id} className="titan-surface p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{driver.name}</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {driver.match.score}% match
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{driver.city || "Location not listed"}</p>
                  <p className="mt-1 text-sm text-foreground">{driver.yearsExperience || 0} yrs experience · {formatDriverRate(driver)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" asChild><Link to={`/driver/${driver.id}`}>View profile</Link></Button>
                  <Button onClick={() => setHireTarget(driver)}>Request worker</Button>
                </div>
              </div>

              {driver.match.reasons.length ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Why this match</p>
                  <div className="flex flex-wrap gap-2">
                    {driver.match.reasons.map((reason) => (
                      <span key={reason} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />{reason}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {driver.skills?.length ? <p className="text-xs text-muted-foreground">Skills: {driver.skills.slice(0, 6).join(", ")}</p> : null}
              {driver.certifications?.length ? <p className="text-xs text-muted-foreground">Credentials: {driver.certifications.slice(0, 6).join(", ")}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={BriefcaseBusiness} title="No qualified published workers yet" description="Required credentials are hard filters. Try reviewing the job requirements or check again as more professionals publish profiles." actionLabel="Back to My posts" onAction={() => navigate("/hire?tab=posts")} />
      )}

      <HireRequestDialog driver={hireTarget} open={!!hireTarget} onOpenChange={(open) => !open && setHireTarget(null)} />
    </PageShell>
  );
}
