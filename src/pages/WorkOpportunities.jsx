import React from "react";
import { Link } from "react-router";
import {
  Bookmark,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getWorkOpportunities } from "@/lib/workOpportunitiesApi";
import { applyToHireJob, toggleSaveJob } from "@/lib/hireApi";
import { recordOpportunityResponse } from "@/lib/engagementApi";
import { DATA_SOURCE, getSource } from "@/lib/dataSource";

function money(job) {
  const min = Number(job?.budget_min || 0);
  const max = Number(job?.budget_max || 0);
  if (min && max) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return "Quote / pay not specified";
}

function OpportunityCard({ opportunity, busy, onInterested, onSave }) {
  const score = Number(opportunity.match?.score || 0);
  const reasons = Array.isArray(opportunity.match?.reasons) ? opportunity.match.reasons : [];
  const blockers = Array.isArray(opportunity.match?.blockers) ? opportunity.match.blockers : [];
  const state = opportunity.interaction_state || null;
  const broad = Boolean(opportunity.match?.broad_discovery);

  return (
    <article className="titan-surface space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
              opportunity.relationship_type === "customer_request"
                ? "bg-success/10 text-success"
                : "bg-primary/10 text-primary"
            }`}>
              {opportunity.relationship_label || (opportunity.relationship_type === "customer_request" ? "Customer Request" : "Contract Opportunity")}
            </span>
            {state ? <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{state}</span> : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{opportunity.title || "Independent work"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{opportunity.category || "General"}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-primary/10 px-3 py-2 text-right">
          <p className="text-xl font-bold tabular-nums text-primary">{score}%</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{broad ? "nearby signal" : "service match"}</p>
        </div>
      </div>

      {opportunity.description ? (
        <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{opportunity.description}</p>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {(opportunity.city || opportunity.state) ? (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{[opportunity.city, opportunity.state].filter(Boolean).join(", ")}</span>
        ) : null}
        <span className="inline-flex items-center gap-1"><BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" />{money(opportunity)}</span>
        {opportunity.deadline ? <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Due {new Date(`${opportunity.deadline}T12:00:00`).toLocaleDateString()}</span> : null}
      </div>

      {reasons.length ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Why Titan surfaced this</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground/90">
            {reasons.slice(0, 4).map((reason) => (
              <li key={reason} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" /><span>{reason}</span></li>
            ))}
          </ul>
        </div>
      ) : null}

      {blockers.length ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p className="text-xs font-semibold text-warning">Profile or requirement check</p>
          {blockers.slice(0, 3).map((item) => <p key={item} className="mt-1 text-xs text-muted-foreground">{item}</p>)}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onSave(opportunity)} className="gap-2">
          <Bookmark className={`h-4 w-4 ${state === "saved" ? "fill-current" : ""}`} aria-hidden="true" />
          {state === "saved" ? "Saved" : "Save"}
        </Button>
        <Button type="button" disabled={busy || state === "interested"} onClick={() => onInterested(opportunity)}>
          {state === "interested" ? "Interest sent" : "I'm interested"}
        </Button>
      </div>
    </article>
  );
}

export default function WorkOpportunities() {
  const { user } = useAuth();
  const [state, setState] = React.useState({ loading: true, opportunities: [], counts: {}, needsProfile: false, discoveryMode: "broad" });
  const [busy, setBusy] = React.useState("");

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    setState((current) => ({ ...current, loading: true }));
    try {
      const result = await getWorkOpportunities();
      setState({ loading: false, ...result });
    } catch (error) {
      setState((current) => ({ ...current, loading: false }));
      toast({ variant: "destructive", title: "Couldn't load work opportunities", description: error?.message || "Try again." });
    }
  }, [user?.id]);

  React.useEffect(() => { void load(); }, [load]);

  const interested = async (opportunity) => {
    if (!user?.id || busy) return;
    setBusy(opportunity.id);
    try {
      const application = await applyToHireJob(user, opportunity.id, {
        message: `Interested in this ${opportunity.relationship_type === "customer_request" ? "service request" : "contract opportunity"}.`,
        bid_amount: "",
      });
      if (getSource(application) !== DATA_SOURCE.local && application?.id) {
        try {
          await recordOpportunityResponse(application.id, opportunity.id);
        } catch {
          // The application itself is the source of truth. If event recording is
          // unavailable, do not roll back or fake the Engagement record.
        }
      }
      setState((current) => ({
        ...current,
        opportunities: current.opportunities.map((row) => row.id === opportunity.id ? { ...row, interaction_state: "interested" } : row),
        counts: { ...current.counts, interested: Number(current.counts?.interested || 0) + 1 },
      }));
      toast({ title: "Interest sent", description: "The opportunity owner can now review your interest. This does not create an employment relationship." });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't send interest", description: error?.message || "Try again." });
    } finally {
      setBusy("");
    }
  };

  const save = async (opportunity) => {
    if (!user?.id || busy) return;
    setBusy(opportunity.id);
    try {
      const next = await toggleSaveJob(user.id, opportunity.id);
      setState((current) => ({
        ...current,
        opportunities: current.opportunities.map((row) => row.id === opportunity.id ? { ...row, interaction_state: next ? "saved" : null } : row),
      }));
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't update saved opportunity", description: error?.message || "Try again." });
    } finally {
      setBusy("");
    }
  };

  const counts = state.counts || {};

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader
        eyebrow="Independent Work"
        title="Opportunities Near You"
        subtitle="Contracts and customer requests are kept separate from employee job openings so you always know what kind of work relationship you're considering."
        actions={<Button type="button" variant="outline" onClick={load} disabled={state.loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</Button>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Independent opportunity snapshot">
        {[
          ["Opportunities", counts.total || 0],
          ["Strong matches", counts.strong || 0],
          ["Customer requests", counts.customerRequests || 0],
          ["Contracts", counts.contracts || 0],
          ["Interested", counts.interested || 0],
        ].map(([label, value]) => (
          <div key={label} className="titan-surface p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p></div>
        ))}
      </section>

      {state.needsProfile ? (
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-foreground">You're seeing a broad opportunity feed</p>
                <p className="mt-1 text-sm text-muted-foreground">Complete your Service Profile to rank opportunities by services, skills, credentials, service area, and availability. Titan still shows available independent work before profile completion.</p>
              </div>
            </div>
            <Button asChild className="shrink-0"><Link to="/service-profile">Build Service Profile</Link></Button>
          </div>
        </section>
      ) : null}

      {state.loading ? (
        <div className="titan-surface flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Finding independent work…</div>
      ) : state.opportunities?.length ? (
        <section aria-labelledby="independent-feed-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div><h2 id="independent-feed-heading" className="text-lg font-semibold text-foreground">For you</h2><p className="text-xs text-muted-foreground">{state.discoveryMode === "matched" ? "Ranked from your Service Profile." : "Broad nearby discovery until your Service Profile is complete."}</p></div>
            <span className="text-xs text-muted-foreground">{state.opportunities.length} shown</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {state.opportunities.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} busy={busy === opportunity.id} onInterested={interested} onSave={save} />)}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={FileText}
          title="No independent opportunities are open right now"
          description="Titan only shows contract opportunities and customer requests in this workspace. Employment openings stay in Job Seeker."
          actionLabel="Review Service Profile"
          onAction={() => { window.location.href = "/service-profile"; }}
        />
      )}
    </PageShell>
  );
}
