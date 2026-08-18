import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  FolderKanban,
  Package,
  Receipt,
  RefreshCw,
  Truck,
  UserRoundCog,
  Users,
  Workflow,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/lib/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DashboardSkeleton } from "@/components/shared/SkeletonLoader";
import ErrorState from "@/components/shared/ErrorState";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatCurrency";

const DAILY_OPERATIONS = [
  { label: "Jobs", description: "Create, assign, and complete work", path: "/jobs", icon: Briefcase },
  { label: "Schedule", description: "Plan the day and upcoming work", path: "/schedule", icon: Calendar },
  { label: "Customers", description: "Manage every customer relationship", path: "/customers", icon: Users },
  { label: "Estimates", description: "Price work and win approvals", path: "/estimates", icon: FileText },
  { label: "Invoices", description: "Bill completed work", path: "/invoices", icon: Receipt },
  { label: "Payments", description: "Track money received", path: "/payments", icon: CreditCard },
];

const BUSINESS_MANAGEMENT = [
  { label: "Employees", description: "Team roster, roles, and field staff", path: "/employees", icon: UserRoundCog },
  { label: "Fleet", description: "Vehicles, equipment, service, and fleet operations", path: "/fleet", icon: Truck },
  { label: "Inventory", description: "Supplies, parts, costs, and low-stock alerts", path: "/inventory", icon: Package },
  { label: "Business Documents", description: "Credentials, contracts, and insurance", path: "/business-documents", icon: FolderKanban },
];

const EXTENSIONS = [
  {
    label: "Find Work",
    description: "Find additional work when the business needs more jobs.",
    path: "/hire/matches",
    icon: Briefcase,
  },
  {
    label: "Titan Auto + Leads",
    description: "Build the lead pipeline and automate approved repetitive work.",
    path: "/autopilot",
    icon: Workflow,
  },
  {
    label: "2nd Self",
    description: "Use Titan intelligence, memory, and approved actions across the business.",
    path: "/second-me",
    icon: Brain,
  },
];

function Metric({ label, value, hint }) {
  return (
    <div className="titan-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function WorkspaceGrid({ items, columns = "lg:grid-cols-3" }) {
  const navigate = useNavigate();
  return (
    <div className={`mt-4 grid gap-2 sm:grid-cols-2 ${columns}`}>
      {items.map((item) => (
        <button
          key={item.path}
          type="button"
          onClick={() => navigate(item.path)}
          className="group rounded-xl border border-border bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-ring"
        >
          <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="mt-3 font-semibold text-foreground">{item.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
        </button>
      ))}
    </div>
  );
}

export default function Dashboard({ isActive = true }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, partialError, reload } = useDashboardData({ enabled: isActive });
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  if (!isActive && !data) return null;
  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <ErrorState
        title="Couldn't load Titan Business"
        message="Your business data could not be loaded. Retry when the connection is available."
        onRetry={reload}
      />
    );
  }
  if (!data) return <DashboardSkeleton />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader
        eyebrow="Business Operating System"
        title={`${greeting}, ${name}`}
        subtitle="Run jobs, customers, people, fleet, inventory, billing, and payments from one business-first operating view."
        actions={
          <Button type="button" variant="outline" onClick={refresh} disabled={refreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {partialError ? (
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <p>Some business data did not refresh. The sections that loaded are still available.</p>
        </div>
      ) : null}

      <section aria-label="Business snapshot" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Jobs today" value={data.todayJobs.length} hint={`${data.inProgressJobs.length} in progress`} />
        <Metric label="This week" value={formatCurrency(data.weekRevenue || 0)} hint="Paid revenue" />
        <Metric label="Outstanding" value={formatCurrency(data.outstandingTotal || 0)} hint={`${data.overdueInv.length} overdue`} />
        <Metric label="Customers" value={data.totalCustomers || 0} hint={`${data.pendingEst.length} estimates waiting`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="titan-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Operate</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Daily business operations</h2>
            </div>
            <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <WorkspaceGrid items={DAILY_OPERATIONS} />
        </div>

        <div className="titan-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Needs attention</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Next actions</h2>
          <div className="mt-3 divide-y divide-border">
            {data.nextActions.slice(0, 3).map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={`${action.path}-${action.text}`}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="flex min-h-[64px] w-full items-center gap-3 py-3 text-left hover:text-primary focus-ring"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{action.text}</span>
                    <span className="block truncate text-xs text-muted-foreground">{action.sub}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="titan-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next 7 days</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Upcoming work</h2>
          </div>
          <Button type="button" variant="ghost" onClick={() => navigate("/schedule")} className="gap-1">
            Schedule <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {data.upcomingJobs.length ? (
          <div className="mt-3 divide-y divide-border">
            {data.upcomingJobs.slice(0, 4).map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate("/jobs")}
                className="flex min-h-[60px] w-full items-center gap-3 py-3 text-left focus-ring"
              >
                <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{job.title || "Job"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[job.scheduled_date, job.scheduled_time, job.customer_name].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {job.amount ? <span className="text-sm font-semibold tabular-nums">{formatCurrency(job.amount)}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            No scheduled work in the next seven days.
          </div>
        )}
      </section>

      <section className="titan-surface p-5" aria-label="Business management">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Manage the company</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">People, fleet, inventory, and records</h2>
          <p className="mt-1 text-sm text-muted-foreground">The operating infrastructure behind the jobs.</p>
        </div>
        <WorkspaceGrid items={BUSINESS_MANAGEMENT} columns="lg:grid-cols-4" />
      </section>

      <section aria-label="Business extensions">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business extensions</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Add intelligence and growth when you need it</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {EXTENSIONS.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="titan-surface group p-5 text-left transition-colors hover:border-primary/40 focus-ring"
            >
              <item.icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">{item.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </p>
            </button>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
