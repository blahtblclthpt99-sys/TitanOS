import React from "react";
import { Link, useLocation } from "react-router";
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, MapPin, ShieldCheck, Wrench } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getPublishedServiceProfileByUserId } from "@/lib/serviceProfilesApi";

function currentId(pathname) {
  const marker = "/talent/service/";
  const index = String(pathname || "").indexOf(marker);
  return index >= 0 ? decodeURIComponent(String(pathname).slice(index + marker.length).split("/")[0] || "") : "";
}

function pricing(profile) {
  if (profile.pricingMode === "hourly" && profile.hourlyRate) return `$${profile.hourlyRate.toLocaleString()}/hr`;
  if (profile.pricingMode === "starting_at" && profile.startingPrice) return `Starting at $${profile.startingPrice.toLocaleString()}`;
  if (profile.pricingMode === "flat") return profile.startingPrice ? `Flat rate from $${profile.startingPrice.toLocaleString()}` : "Flat-rate pricing";
  return "Quote required";
}

export default function ServiceTalentProfile() {
  const location = useLocation();
  const id = currentId(location.pathname);
  const [state, setState] = React.useState({ loading: true, profile: null });

  React.useEffect(() => {
    let alive = true;
    if (!id) {
      setState({ loading: false, profile: null });
      return () => { alive = false; };
    }
    getPublishedServiceProfileByUserId(id)
      .then((profile) => { if (alive) setState({ loading: false, profile }); })
      .catch(() => { if (alive) setState({ loading: false, profile: null }); });
    return () => { alive = false; };
  }, [id]);

  if (state.loading) return <PageLoader variant="list" label="Loading Service Profile" />;
  if (!state.profile) {
    return (
      <PageShell maxWidth="lg" className="space-y-5">
        <PageHeader eyebrow="Talent" title="Service Profile unavailable" subtitle="This independent worker may have unpublished their profile." />
        <EmptyState icon={Wrench} title="Profile unavailable" description="Only currently published Service Profiles are available to businesses." actionLabel="Back to Talent" onAction={() => { window.location.href = "/talent"; }} />
      </PageShell>
    );
  }

  const profile = state.profile;
  return (
    <PageShell maxWidth="lg" className="space-y-5">
      <Button asChild variant="ghost" className="w-fit gap-2 px-2"><Link to="/talent"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Talent</Link></Button>
      <PageHeader
        eyebrow="Published Service Profile"
        title={profile.displayName || profile.businessName || "Independent worker"}
        subtitle="Professional service information this person chose to publish for contract, project, and customer-request matching."
      />

      <section className="titan-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{profile.displayName || "Independent worker"}</h2>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${profile.availability === "available" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{profile.availability}</span>
            </div>
            {profile.businessName ? <p className="mt-1 text-sm font-medium text-foreground/90">{profile.businessName}</p> : null}
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden="true" />{[profile.serviceCity, profile.serviceState].filter(Boolean).join(", ") || "Service area not listed"} · up to {profile.serviceRadiusMiles} miles</p>
            {profile.bio ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">{profile.bio}</p> : null}
          </div>
          <div className="min-w-[180px] rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pricing</p>
            <p className="mt-1 text-lg font-bold text-foreground">{pricing(profile)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Published pricing is informational and can still require a project-specific quote.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="titan-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><BriefcaseBusiness className="h-4 w-4 text-primary" aria-hidden="true" />Services & skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...(profile.services || []), ...(profile.skills || [])].length ? [...new Set([...(profile.services || []), ...(profile.skills || [])])].map((item) => <span key={item} className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground">{item}</span>) : <p className="text-sm text-muted-foreground">No services listed.</p>}
          </div>
        </section>
        <section className="titan-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />Credentials</h2>
          <div className="mt-3 space-y-2">
            {[...(profile.licenses || []), ...(profile.certifications || [])].length ? [...new Set([...(profile.licenses || []), ...(profile.certifications || [])])].map((item) => <div key={item} className="flex gap-2 text-sm text-foreground"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{item}</span></div>) : <p className="text-sm text-muted-foreground">No licenses or certifications listed.</p>}
          </div>
        </section>
      </div>

      <section className="titan-surface p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground"><Wrench className="h-4 w-4 text-primary" aria-hidden="true" />Equipment</h2>
        <div className="mt-3 flex flex-wrap gap-2">{profile.equipment?.length ? profile.equipment.map((item) => <span key={item} className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground">{item}</span>) : <p className="text-sm text-muted-foreground">No equipment listed.</p>}</div>
      </section>

      <section className="titan-surface p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-foreground">Profile and trust boundary</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {profile.insured ? "This worker reports applicable insurance. " : "No insurance claim is shown. "}
              Published Service Profiles show a general service area, not a home address. User-reported licenses, insurance, and credentials are not labeled verified unless Titan separately verifies them.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
