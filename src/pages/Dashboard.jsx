import React from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/lib/AuthContext";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  Compass,
  FileUser,
  Route,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";

const primaryActions = [
  {
    title: "Find jobs",
    description: "Search and review current work opportunities.",
    path: "/jobs",
    icon: BriefcaseBusiness,
  },
  {
    title: "Opportunity matches",
    description: "Review job matches and why they may fit your profile.",
    path: "/hire/matches",
    icon: UserRoundSearch,
  },
  {
    title: "Career profile",
    description: "Keep your experience, skills, credentials, and work goals current.",
    path: "/profile",
    icon: FileUser,
  },
  {
    title: "TitanAI career coach",
    description: "Prepare applications, interviews, follow-ups, and career plans.",
    path: "/assistant?mode=career",
    icon: Sparkles,
  },
];

const progressActions = [
  { title: "Schedule", description: "Keep interviews, shifts, jobs, and follow-ups organized.", path: "/schedule", icon: CalendarDays },
  { title: "Companies", description: "Research and organize employers and work relationships.", path: "/companies", icon: Building2 },
  { title: "Notifications", description: "See updates that need your attention.", path: "/notifications", icon: Bell },
];

const workTools = [
  { title: "Driver Hub", path: "/driver" },
  { title: "Route Planner", path: "/routes" },
  { title: "Customers", path: "/customers" },
  { title: "Estimates", path: "/estimates" },
  { title: "Invoices", path: "/invoices" },
  { title: "More work tools", path: "/more" },
];

function ActionCard({ item }) {
  const navigate = useNavigate();
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => navigate(item.path)}
      className="group flex min-h-[150px] w-full flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-lg font-bold text-foreground">{item.title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = String(user?.full_name || user?.user_metadata?.full_name || "").trim().split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 md:py-8 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              <Compass className="h-4 w-4" aria-hidden="true" />
              Career Command Center
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              {firstName ? `${firstName}, what is your next move?` : "What is your next move?"}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              TitanOS keeps the highest-value career actions in front of you: find opportunities, understand your matches, prepare stronger applications, and keep progress organized.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => navigate("/jobs")} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" /> Find opportunities
              </button>
              <button type="button" onClick={() => navigate("/assistant?mode=career")} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Ask TitanAI
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">TitanOS career path</p>
            <div className="mt-4 space-y-3">
              {["Discover opportunities", "Match skills and goals", "Prepare and apply", "Interview and follow up", "Get hired and organize the work"].map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
                  <span className="text-sm font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Start here</p><h2 className="mt-1 text-2xl font-black tracking-tight">Career actions</h2></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {primaryActions.map((item) => <ActionCard key={item.path} item={item} />)}
        </div>
      </section>

      <section className="mt-8">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Stay moving</p><h2 className="mt-1 text-2xl font-black tracking-tight">Career progress</h2></div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {progressActions.map((item) => <ActionCard key={item.path} item={item} />)}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-muted/25 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-card text-primary shadow-soft"><Route className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Already working?</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Operational tools are still here when you need them, but they no longer compete with TitanOS's jobs-and-careers mission.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {workTools.map((item) => (
                <button key={item.path} type="button" onClick={() => navigate(item.path)} className="min-h-[40px] rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
