import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, Briefcase, Loader2, Sparkles, UserSearch } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { loadEmployerWorkerMatches } from "@/lib/employerWorkerMatchApi";

function CandidateCard({ worker }) {
  return (
    <article className="titan-surface space-y-3 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserSearch className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-foreground">{worker.name}</h2>
              <p className="text-xs text-muted-foreground">
                {worker.city || "Location not listed"}
                {worker.yearsExperience ? ` · ${worker.yearsExperience} yrs experience` : ""}
                {worker.distanceMi ? ` · ${Number(worker.distanceMi).toFixed(1)} mi away` : ""}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-right">
              <p className="text-lg font-bold tabular-nums text-primary">{worker.match.score}%</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">fit</p>
            </div>
          </div>
        </div>
      </div>

      {worker.match.reasons.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {worker.match.reasons.map((reason) => (
            <span key={reason} className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-foreground">{reason}</span>
          ))}
        </div>
      ) : null}

      {worker.match.blockers.length > 0 ? (
        <p className="text-xs text-muted-foreground">{worker.match.blockers.join(" · ")}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {worker.skills?.length ? worker.skills.slice(0, 5).join(" · ") : "Published professional profile"}
        </p>
        <Button asChild size="sm">
          <Link to={`/talent/worker/${encodeURIComponent(worker.id)}`}>View talent profile</Link>
        </Button>
      </div>
    </article>
  );
}

export default function WorkerMatches() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const jobId = params.get("job") || "";
  const [state, setState] = useState({ loading: true, job: null, matches: [], error: "" });

  useEffect(() => {
    let alive = true;
    if (!user?.id || !jobId) {
      setState({ loading: false, job: null, matches: [], error: jobId ? "Sign in to view candidates." : "Choose a recruiting job first." });
      return () => { alive = false; };
    }

    setState((old) => ({ ...old, loading: true, error: "" }));
    loadEmployerWorkerMatches(user, jobId)
      .then(({ job, matches }) => {
        if (alive) setState({ loading: false, job, matches, error: "" });
      })
      .catch((error) => {
        if (alive) setState({ loading: false, job: null, matches: [], error: error?.message || "Could not load worker matches." });
      });

    return () => { alive = false; };
  }, [jobId, user?.id, user?.role]);

  return (
    <PageShell maxWidth="lg" className="space-y-5">
      <PageHeader
        eyebrow="Business · Talent"
        title="Matching candidates"
        subtitle="Titan ranks opt-in job seekers by required qualifications, skills, experience, location, and current availability for this job."
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/talent"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Talent</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/hire/post-match-ready">Create recruiting job</Link></Button>
      </div>

      {state.loading ? (
        <div className="titan-surface flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Ranking nearby qualified candidates…
        </div>
      ) : state.error ? (
        <EmptyState icon={Briefcase} title="Candidate matches unavailable" description={state.error} />
      ) : (
        <>
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-foreground">{state.job?.title || "Selected job"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.matches.length} eligible published job seeker{state.matches.length === 1 ? "" : "s"} ranked. Required credentials are hard filters; experience and distance remain explainable ranking factors.
                </p>
              </div>
            </div>
          </section>

          {state.matches.length ? (
            <div className="space-y-3">
              {state.matches.map((worker) => <CandidateCard key={worker.id} worker={worker} />)}
            </div>
          ) : (
            <EmptyState
              icon={UserSearch}
              title="No matching job seekers yet"
              description="No opt-in profiles currently meet this job's required qualifications and minimum fit threshold. Keep the recruiting job open; new matching seekers can become visible as they complete their profiles."
            />
          )}
        </>
      )}
    </PageShell>
  );
}
