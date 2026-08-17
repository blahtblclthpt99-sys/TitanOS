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
      setState({ loading: false, jobs: [], error: "Sign in to find workers for your posts." });
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
        if (alive) setState({ loading: false, jobs: [], error: error?.message || "Could not load your Hire posts." });
      });

    return () => { alive = false; };
  }, [user?.id]);

  return (
    <PageShell maxWidth="lg" className="space-y-5">
      <PageHeader
        eyebrow="Hire"
        title="Find workers for my posts"
        subtitle="Choose one of your existing Hire posts and Titan will rank eligible published worker profiles against it."
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/hire?tab=posts">My posts</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/hire/post-match-ready">Post a match-ready job</Link></Button>
      </div>

      {state.loading ? (
        <div className="titan-surface flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your posts…
        </div>
      ) : state.error ? (
        <EmptyState icon={BriefcaseBusiness} title="Your Hire posts are unavailable" description={state.error} />
      ) : state.jobs.length ? (
        <div className="space-y-3">
          {state.jobs.map((job) => (
            <article key={job.id} className="titan-surface p-4 md:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground truncate">{job.title || "Untitled Hire post"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {job.category || "General"} · {formatBudget(job)} · {job.status || "open"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  {job.required_skills?.length ? `Skills: ${job.required_skills.join(", ")}` : "Titan will use the title/category when explicit skills are not set."}
                </p>
              </div>
              <Button asChild className="min-h-[44px] shrink-0 gap-2">
                <Link to={`/hire/candidates?job=${encodeURIComponent(job.id)}`}>
                  <UserSearch className="h-4 w-4" aria-hidden="true" />Find matching workers
                </Link>
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No Hire posts yet"
          description="Create a match-ready job first, then Titan can rank published workers against the requirements."
          actionLabel="Post a match-ready job"
          onAction={() => { window.location.href = "/hire/post-match-ready"; }}
        />
      )}
    </PageShell>
  );
}
