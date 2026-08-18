import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { BriefcaseBusiness, Loader2, UserSearch } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { listHireJobs, formatBudget } from "@/lib/hireApi";

export default function ExistingPostWorkerMatches() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, jobs: [], error: "" });

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setState({ loading: false, jobs: [], error: "Sign in to manage recruiting." });
      return () => { alive = false; };
    }

    setState({ loading: true, jobs: [], error: "" });
    listHireJobs({ status: "all" })
      .then((rows) => {
        if (!alive) return;
        const mine = (rows || [])
          .filter((job) => (job.customer_id || job.created_by_id) === user.id)
          .sort((a, b) => new Date(b.created_date || b.created_at || 0) - new Date(a.created_date || a.created_at || 0));
        setState({ loading: false, jobs: mine, error: "" });
      })
      .catch((error) => {
        if (alive) setState({ loading: false, jobs: [], error: error?.message || "Could not load recruiting jobs." });
      });

    return () => { alive = false; };
  }, [user?.id]);

  return (
    <PageShell maxWidth="lg" className="space-y-5">
      <PageHeader
        eyebrow="Business · Talent"
        title="Talent"
        subtitle="Post the role once. Titan ranks nearby opt-in job seekers by skills, qualifications, experience, location, and availability so your business can identify people worth reaching out to."
      />

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
        Job seekers control whether their professional profile is discoverable. Private pay preferences and precise search coordinates are not shown to businesses.
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/hire/post-match-ready">Create recruiting job</Link></Button>
        <Button asChild variant="outline"><Link to="/employees">Employees</Link></Button>
      </div>

      {state.loading ? (
        <div className="titan-surface flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading recruiting jobs…
        </div>
      ) : state.error ? (
        <EmptyState icon={BriefcaseBusiness} title="Recruiting unavailable" description={state.error} />
      ) : state.jobs.length ? (
        <div className="space-y-3">
          {state.jobs.map((job) => (
            <article key={job.id} className="titan-surface flex flex-col gap-3 p-4 md:p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold text-foreground">{job.title || "Untitled role"}</h2>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{job.status || "open"}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{job.category || "General"} · {formatBudget(job)}</p>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {job.required_skills?.length ? `Skills: ${job.required_skills.join(", ")}` : "Add required skills and qualifications to make Titan's candidate ranking more precise."}
                </p>
              </div>
              <Button asChild className="min-h-[44px] shrink-0 gap-2">
                <Link to={`/hire/candidates?job=${encodeURIComponent(job.id)}`}>
                  <UserSearch className="h-4 w-4" aria-hidden="true" />See matching candidates
                </Link>
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No recruiting jobs yet"
          description="Create a recruiting job with location, skills, qualifications, and experience requirements. Titan can then rank opt-in job seekers against it."
          actionLabel="Create recruiting job"
          onAction={() => { window.location.href = "/hire/post-match-ready"; }}
        />
      )}
    </PageShell>
  );
}
