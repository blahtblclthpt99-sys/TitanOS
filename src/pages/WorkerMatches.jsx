import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, Briefcase, Handshake, Loader2, Sparkles, UserSearch } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import EngagementSignal from "@/components/trust/EngagementSignal";
import { useAuth } from "@/lib/AuthContext";
import { loadEmployerWorkerMatches } from "@/lib/employerWorkerMatchApi";
import { getEngagementBatch } from "@/lib/engagementApi";

function CandidateCard({ worker, opportunityId, engagement }) {
  const service = worker.profileKind === "service";
  const profilePath = service
    ? `/talent/service/${encodeURIComponent(worker.id)}`
    : `/talent/worker/${encodeURIComponent(worker.id)}`;

  return (
    <article className="titan-surface space-y-3 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {service ? <Handshake className="h-5 w-5" aria-hidden="true" /> : <UserSearch className="h-5 w-5" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-foreground">{worker.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{service ? "Service Profile" : "Job Seeker"}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {worker.city || "Location not listed"}
                {worker.yearsExperience ? ` · ${worker.yearsExperience} yrs experience` : ""}
                {worker.distanceMi ? ` · ${Number(worker.distanceMi).toFixed(1)} mi away` : ""}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-right">
              <p className="text-lg font-bold tabular-nums text-primary">{worker.match.score}%</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{service ? "service match" : "job match"}</p>
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

      {worker.match.blockers.length > 0 ? <p className="text-xs text-muted-foreground">{worker.match.blockers.join(" · ")}</p> : null}

      {engagement ? (
        <EngagementSignal
          subjectUserId={worker.id}
          opportunityId={opportunityId}
          snapshot={engagement}
          compact
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {worker.skills?.length ? worker.skills.slice(0, 5).join(" · ") : service ? "Published service information" : "Published professional profile"}
        </p>
        <Button asChild size="sm"><Link to={profilePath}>{service ? "View Service Profile" : "View Job Seeker Profile"}</Link></Button>
      </div>
    </article>
  );
}

export default function WorkerMatches() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const jobId = params.get("job") || "";
  const [state, setState] = useState({ loading: true, job: null, matches: [], profileKind: "employment", engagement: {}, error: "" });

  useEffect(() => {
    let alive = true;
    if (!user?.id || !jobId) {
      setState({ loading: false, job: null, matches: [], profileKind: "employment", engagement: {}, error: jobId ? "Sign in to view matches." : "Choose an opportunity first." });
      return () => { alive = false; };
    }

    setState((old) => ({ ...old, loading: true, error: "" }));
    loadEmployerWorkerMatches(user, jobId)
      .then(async ({ job, matches, profileKind }) => {
        // Qualification ordering is complete before Engagement is requested.
        // Engagement snapshots are attached by id only and never re-sort/filter.
        let engagement = {};
        try {
          engagement = await getEngagementBatch({
            subjectUserIds: matches.map((row) => row.id),
            opportunityId: jobId,
          });
        } catch {
          engagement = {};
        }
        if (alive) setState({ loading: false, job, matches, profileKind: profileKind || "employment", engagement, error: "" });
      })
      .catch((error) => {
        if (alive) setState({ loading: false, job: null, matches: [], profileKind: "employment", engagement: {}, error: error?.message || "Could not load matches." });
      });

    return () => { alive = false; };
  }, [jobId, user?.id, user?.role]);

  const service = state.profileKind === "service";

  return (
    <PageShell maxWidth="lg" className="space-y-5">
      <PageHeader
        eyebrow="Business · Talent"
        title={service ? "Matching independent help" : "Matching candidates"}
        subtitle={service
          ? "Titan ranks opt-in Service Profiles by services, skills, required credentials, service area, and availability for this independent opportunity."
          : "Titan ranks opt-in Job Seeker profiles by required qualifications, skills, experience, location, and availability for this employee opportunity."}
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/talent"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Talent</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/hire/post-match-ready">Create opportunity</Link></Button>
      </div>

      {state.loading ? (
        <div className="titan-surface flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Ranking qualified profiles…</div>
      ) : state.error ? (
        <EmptyState icon={Briefcase} title="Matches unavailable" description={state.error} />
      ) : (
        <>
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground">{state.job?.title || "Selected opportunity"}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{state.job?.relationship_type === "employment" ? "Employee Opportunity" : "Contract Opportunity"}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.matches.length} eligible published {service ? "Service Profile" : "Job Seeker profile"}{state.matches.length === 1 ? "" : "s"} ranked. Engagement is loaded only after this order is final and cannot remove, filter, or reorder a qualified profile.
                </p>
              </div>
            </div>
          </section>

          {state.matches.length ? (
            <div className="space-y-3">{state.matches.map((worker) => (
              <CandidateCard
                key={`${worker.profileKind || state.profileKind}:${worker.id}`}
                worker={worker}
                opportunityId={jobId}
                engagement={state.engagement?.[worker.id]}
              />
            ))}</div>
          ) : (
            <EmptyState
              icon={UserSearch}
              title={service ? "No matching independent profiles yet" : "No matching Job Seekers yet"}
              description={service
                ? "No published Service Profiles currently meet this opportunity's required credentials and minimum match threshold."
                : "No opt-in Job Seeker profiles currently meet this opportunity's required qualifications and minimum match threshold."}
            />
          )}
        </>
      )}
    </PageShell>
  );
}
