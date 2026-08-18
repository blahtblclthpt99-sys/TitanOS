import React from "react";
import { Link, useLocation } from "react-router";
import { ArrowLeft, Award, BadgeCheck, BriefcaseBusiness, MapPin, ShieldCheck, UserSearch } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getDriverProfileById } from "@/lib/driverProfilesApi";

function currentWorkerId(pathname) {
  const marker = "/talent/worker/";
  const index = String(pathname || "").indexOf(marker);
  return index >= 0 ? decodeURIComponent(String(pathname).slice(index + marker.length).split("/")[0] || "") : "";
}

export default function TalentProfile() {
  const location = useLocation();
  const id = currentWorkerId(location.pathname);
  const [state, setState] = React.useState({ loading: true, worker: null });

  React.useEffect(() => {
    let alive = true;
    if (!id) {
      setState({ loading: false, worker: null });
      return () => { alive = false; };
    }
    setState({ loading: true, worker: null });
    getDriverProfileById(id)
      .then((worker) => { if (alive) setState({ loading: false, worker }); })
      .catch(() => { if (alive) setState({ loading: false, worker: null }); });
    return () => { alive = false; };
  }, [id]);

  if (state.loading) return <PageLoader variant="list" label="Loading talent profile" />;
  if (!state.worker) {
    return (
      <PageShell maxWidth="lg" className="space-y-5">
        <PageHeader eyebrow="Talent" title="Profile unavailable" subtitle="This published worker profile is not available." />
        <EmptyState icon={UserSearch} title="Worker profile unavailable" description="The worker may have unpublished their profile or it may no longer exist." actionLabel="Back to Talent" onAction={() => { window.location.href = "/talent"; }} />
      </PageShell>
    );
  }

  const worker = state.worker;
  return (
    <PageShell maxWidth="lg" className="space-y-5">
      <Button asChild variant="ghost" className="w-fit gap-2 px-2">
        <Link to="/talent"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Talent</Link>
      </Button>

      <PageHeader
        eyebrow="Published Talent Profile"
        title={worker.name || "Worker"}
        subtitle="Professional qualifications shared by this job seeker for business recruiting and job matching."
      />

      <section className="titan-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{worker.name || "Worker"}</h2>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${worker.availability === "available" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {worker.availability === "available" ? "Available" : worker.availability || "Availability unknown"}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden="true" />{worker.city || "Location not listed"}</p>
            {worker.bio ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">{worker.bio}</p> : null}
          </div>
          <div className="grid min-w-[180px] grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <Award className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />
              <p className="mt-1 text-lg font-bold text-foreground">{worker.yearsExperience || 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Years exp.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <BriefcaseBusiness className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />
              <p className="mt-1 text-lg font-bold text-foreground">{worker.completedJobs || 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Titan jobs</p>
            </div>
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
            {worker.certifications?.length ? worker.certifications.map((item) => (
              <div key={item} className="flex gap-2 text-sm text-foreground"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{item}</span></div>
            )) : <p className="text-sm text-muted-foreground">No certifications listed.</p>}
          </div>
        </section>
      </div>

      <section className="titan-surface p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-foreground">Business recruiting boundary</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">This view shows only the professional information the job seeker chose to publish. Private job-search radius, desired pay preferences, and precise search coordinates are not exposed here.</p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
