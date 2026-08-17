import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, Briefcase, Loader2, Sparkles, UserSearch } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { loadEmployerWorkerMatches } from "@/lib/employerWorkerMatchApi";

function CandidateCard({ driver }) {
  return (
    <article className="titan-surface p-4 md:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserSearch className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-foreground">{driver.name}</h2>
              <p className="text-xs text-muted-foreground">
                {driver.city || "Location not listed"}
                {driver.yearsExperience ? ` · ${driver.yearsExperience} yrs experience` : ""}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-right">
              <p className="text-lg font-bold tabular-nums text-primary">{driver.match.score}%</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">match</p>
            </div>
          </div>
        </div>
      </div>

      {driver.match.reasons.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {driver.match.reasons.map((reason) => (
            <span key={reason} className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-foreground">
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      {driver.match.blockers.length > 0 ? (
        <p className="text-xs text-muted-foreground">{driver.match.blockers.join(" · ")}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {driver.skills?.length ? driver.skills.slice(0, 4).join(" · ") : "Published driver profile"}
        </p>
        <Button asChild size="sm">
          <Link to={`/driver/${driver.id}`}>View profile</Link>
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
      setState({ loading: false, job: null, matches: [], error: jobId ? "Sign in to view candidates." : "Choose a job from Hire first." });
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
        eyebrow="Hire"
        title="Matching workers"
        subtitle="Ranked from published worker profiles using the job's skills, credentials, experience, location and current availability."
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/hire?tab=posts"><ArrowLeft className="h-4 w-4" aria-hidden="true" />My posts</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/driver?folder=directory"><UserSearch className="h-4 w-4" aria-hidden="true" />Browse all published drivers</Link>
        </Button>
      </div>

      {state.loading ? (
        <div className="titan-surface flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Ranking published workers…
        </div>
      ) : state.error ? (
        <EmptyState icon={Briefcase} title="Worker matches unavailable" description={state.error} />
      ) : (
        <>
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-foreground">{state.job?.title || "Selected job"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.matches.length} eligible published worker{state.matches.length === 1 ? "" : "s"} ranked. Required credentials are enforced as hard filters; lower experience remains visible as an explainable ranking factor.
                </p>
              </div>
            </div>
          </section>

          {state.matches.length ? (
            <div className="space-y-3">
              {state.matches.map((driver) => <CandidateCard key={driver.id} driver={driver} />)}
            </div>
          ) : (
            <EmptyState
              icon={UserSearch}
              title="No eligible published workers yet"
              description="No published profiles currently meet this job's required credentials and minimum match threshold. You can still browse the full Driver directory or wait for more workers to publish profiles."
            />
          )}
        </>
      )}
    </PageShell>
  );
}
