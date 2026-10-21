import React from "react";
import { Link } from "react-router";
import { ArrowRight, BriefcaseBusiness, ClipboardList, FileText, Sparkles, UserRound, Wrench } from "lucide-react";

const actions = [
  { to: "/hire/matches", icon: Sparkles, title: "Find matching jobs", detail: "See matching opportunities when the live jobs service is connected.", primary: true },
  { to: "/hire", icon: BriefcaseBusiness, title: "Browse opportunities", detail: "Browse posted jobs when the live job board is available." },
  { to: "/applications", icon: ClipboardList, title: "Track applications", detail: "Organize saved jobs, applications and interviews on this device." },
  { to: "/resume", icon: FileText, title: "Build your résumé", detail: "Write, save and export a résumé on this device." },
  { to: "/profile", icon: UserRound, title: "Update your profile", detail: "Keep your experience and qualifications current." },
  { to: "/assistant", icon: FileText, title: "Interview preparation", detail: "Ask TitanAI for writing, interview practice and career advice." },
];

export default function CareerHub() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-5 sm:px-6 sm:py-8" aria-labelledby="career-heading">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">TitanOS Careers</p>
        <h1 id="career-heading" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Find work. Build your future.</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your job search, résumé, applications, and interview preparation—together in one free workspace.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map(({ to, icon: Icon, title, detail, primary }) => (
          <Link key={to} to={to}
            className={`group flex min-h-[132px] flex-col justify-between rounded-xl border p-4 shadow-sm transition-colors focus-ring hover:border-primary/50 ${primary ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
            <div className="flex items-start justify-between gap-3">
              <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
            </div>
          </Link>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold text-foreground"><ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" /> Your next steps</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Complete your profile before comparing job matches. Review each employer's qualifications and application process independently.
        </p>
      </div>
      <Link to="/more" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-ring">
        <Wrench className="h-4 w-4" aria-hidden="true" /> Business and contractor tools
      </Link>
    </section>
  );
}
