import React from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { ArrowLeft, Award, BadgeCheck, MapPin, ShieldCheck, UserSearch } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import EngagementSignal from "@/components/trust/EngagementSignal";
import { Button } from "@/components/ui/button";
import { getPublishedEmploymentProfileByUserId } from "@/lib/employmentProfilesApi";

function currentWorkerId(pathname) {
  const marker = "/talent/worker/";
  const index = String(pathname || "").indexOf(marker);
  return index >= 0 ? decodeURIComponent(String(pathname).slice(index + marker.length).split("/")[0] || "") : "";
}

export default function TalentProfile() {
  const location = useLocation();
  const [params] = useSearchParams();
  const opportunityId = params.get("job") || "";
  const id = currentWorkerId(location.pathname);
  const [state, setState] = React.useState({ loading: true, worker: null });

  React.useEffect(() => {
    let alive = true;
    if (!id) {
      setState({ loading: false, worker: null });
      return () => { alive = false; };
    }
    setState({ loading: true, worker: null });
    getPublishedEmploymentProfileByUserId(id)
      .then((worker) => { if (alive) setState({ loading: false, worker }); })
      .catch(() => { if (alive) setState({ loading: false, worker: null }); });
    return () => { alive = false; };
  }, [id]);

  if (state.loading) return <PageLoader variant="list" label="Loading talent profile" />;
  if (!state.worker) {
    return (
      <PageShell maxWidth="lg" className="space-y-5">
        <PageHeader eyebrow="Talent" title="Profile unavailable" subtitle="This opt-in employment profile is not available." />
        <EmptyState icon={UserSearch} title="Job Seeker profile unavailable" description="The person may have disabled business discovery or the profile may no longer exist." actionLabel="Back to Talent" onAction={() => { window.location.href = "/talent"; }} />
      </PageShell>
    );
  }

  const worker = state.worker;
  const locationLabel = worker.location || [worker.city, worker.state].filter(Boolean).join(", ");

  return (
    <PageShell maxWidth="lg" className="space-y-5">
      <Button asChild variant="ghost" className="w-fit gap-2 px-2">
        <Link to={opportunityId ? `/hire/candidates?job=${encodeURIComponent(opportunityId)}` : "/talent"}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{opportunityId ? "Candidate matches" : "Talent"}</Link>
      </Button>

      <PageHeader
        eyebrow="Published Job Seeker Profile"
        title={worker.name || "Job Seeker"}
        subtitle="Professional employment information this person explicitly chose to make discoverable to matching businesses."
      />

      <section className="titan-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{worker.name || "Job Seeker"}</h2>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${worker.availability === "available" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {worker.availability === "available" ? "Available" : worker.availability || "Availability unknown"}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden="true" />{locationLabel || "General location not listed"}</p>
            {worker.bio ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">{worker.bio}</p> : null}
          </div>
          <div className="min-w-[150px] rounded-lg border border-border bg-muted/30 p-3 text-center">
            <Award className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />
            <p className="mt-1 text-lg font-bold text-foreground">{worker.yearsExperience || 0}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Years experience</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="titan-surface p-5">
          <h2 className="font-semibold text-foreground">Skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {worker.skills?.length ? worker.skills.map((skill) => <span key={skill} className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground">{skill}</span>) : <p className="text-sm text-muted-foreground">No skills listed.</p>}
          </div>
        </section>
        <section className="titan-surface p-5">
          <h2 className="font-semibold text-foreground">Licenses & qualifications</h2>
          <div className="mt-3 space-y-2">
            {worker.qualifications?.length ? worker.qualifications.map((item) => (
              <div key={item} className="flex gap-2 text-sm text-foreground"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{item}</span></div>
            )) : <p className="text-sm text-muted-foreground">No qualifications listed.</p>}
          </div>
        </section>
      </div>

      {opportunityId ? (
        <section className="space-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Separate interaction signal</p>
            <p className="mt-1 text-sm text-muted-foreground">Engagement is loaded after qualification review and never changes this person's match score, eligibility, visibility, or candidate position.</p>
          </div>
          <EngagementSignal subjectUserId={worker.userId} opportunityId={opportunityId} />
        </section>
      ) : null}

      <section className="titan-surface p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-foreground">Recruiting data boundary</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">This view is backed by Titan's neutral employment profile. Driver/Fleet data, vehicle information, public ratings, exact coordinates, private search radius, and desired pay preferences are not part of this recruiting record.</p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
