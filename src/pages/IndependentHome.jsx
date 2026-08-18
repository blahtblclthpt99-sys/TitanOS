import React from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  Hammer,
  Receipt,
  RefreshCw,
  Sparkles,
  UserCircle,
  Users,
  Workflow,
} from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { getWorkOpportunities } from "@/lib/workOpportunitiesApi";

const TOOLS = [
  { label: "Customers", description: "People and businesses you work for", path: "/customers", icon: Users },
  { label: "Work", description: "Accepted and active service work", path: "/jobs", icon: BriefcaseBusiness },
  { label: "Quotes", description: "Price independent work before it starts", path: "/estimates", icon: FileText },
  { label: "Invoices", description: "Bill completed services", path: "/invoices", icon: Receipt },
  { label: "Money", description: "Track payments you receive", path: "/payments", icon: CreditCard },
  { label: "Service Profile", description: "Services, area, pricing, skills, and credentials", path: "/service-profile", icon: UserCircle },
];

function Stat({ label, value }) {
  return <div className="titan-surface p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p></div>;
}

export default function IndependentHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = React.useState({ loading: true, opportunities: [], counts: {}, needsProfile: false });

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    setState((current) => ({ ...current, loading: true }));
    try {
      const result = await getWorkOpportunities();
      setState({ loading: false, ...result });
    } catch {
      setState((current) => ({ ...current, loading: false }));
    }
  }, [user?.id]);

  React.useEffect(() => { void load(); }, [load]);

  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const counts = state.counts || {};
  const top = (state.opportunities || []).slice(0, 3);

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader
        eyebrow="Independent Work"
        title={`Your work, ${firstName}`}
        subtitle="Find projects and customer requests first, then manage the customers, quotes, work, invoices, and money that come from them—without enterprise overhead."
        actions={<Button type="button" variant="outline" onClick={load} disabled={state.loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</Button>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Independent work snapshot">
        <Stat label="Opportunities" value={counts.total || 0} />
        <Stat label="Strong matches" value={counts.strong || 0} />
        <Stat label="Customer requests" value={counts.customerRequests || 0} />
        <Stat label="Contracts" value={counts.contracts || 0} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="titan-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Opportunities</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Work you can pursue now</h2>
            </div>
            <Hammer className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>

          {top.length ? (
            <div className="mt-4 divide-y divide-border">
              {top.map((opportunity) => (
                <button key={opportunity.id} type="button" onClick={() => navigate("/work-opportunities")} className="flex min-h-[72px] w-full items-center gap-3 py-3 text-left focus-ring">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BriefcaseBusiness className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{opportunity.title || "Independent opportunity"}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{opportunity.relationship_label || "Independent work"}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{[opportunity.city, opportunity.state].filter(Boolean).join(", ") || "Location flexible"} · {Number(opportunity.match?.score || 0)}% {opportunity.match?.broad_discovery ? "nearby signal" : "service match"}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No contract or customer-request opportunities are open right now.</div>
          )}

          <Button type="button" className="mt-4 w-full" onClick={() => navigate("/work-opportunities")}>View all opportunities</Button>
        </div>

        <div className="titan-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Service Profile</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Make matching more precise</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Titan can show broad independent work immediately. Your Service Profile narrows it by services, skills, credentials, service area, pricing style, and availability.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm font-semibold text-foreground">{state.needsProfile ? "Profile needs setup" : "Profile is feeding your matches"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Exact home address is not part of your public Service Profile.</p>
          </div>
          <Button type="button" variant={state.needsProfile ? "default" : "outline"} className="mt-4 w-full" onClick={() => navigate("/service-profile")}>{state.needsProfile ? "Build Service Profile" : "Edit Service Profile"}</Button>
        </div>
      </section>

      <section className="titan-surface p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Lightweight Business OS</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Run the independent work you win</h2>
          <p className="mt-1 text-sm text-muted-foreground">No employees, recruiting, fleet, or enterprise controls unless you activate the full Business workspace.</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((item) => (
            <button key={item.path} type="button" onClick={() => navigate(item.path)} className="rounded-xl border border-border bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-ring">
              <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="titan-surface p-5">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Workflow className="h-5 w-5" aria-hidden="true" /></span>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">TitanAUTO</p><h2 className="mt-1 font-semibold text-foreground">Automation for independent work</h2><p className="mt-1 text-sm text-muted-foreground">Help track opportunities, follow up with customers, prepare quotes, and manage approved repetitive work.</p></div>
          </div>
          <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => navigate("/autopilot")}>Open TitanAUTO</Button>
        </div>

        <div className="titan-surface p-5">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Growing?</p><h2 className="mt-1 font-semibold text-foreground">Activate the full Business OS</h2><p className="mt-1 text-sm text-muted-foreground">When you need employees, hiring, scheduling, fleet, inventory, and advanced operations, enable Business. Your existing customer/work/money data stays with the account.</p></div>
          </div>
          <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => navigate("/account-type")}>Manage workspaces</Button>
        </div>
      </section>
    </PageShell>
  );
}
