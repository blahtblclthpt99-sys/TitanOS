import React from "react";
import { Link } from "react-router";
import { ArrowRight, BriefcaseBusiness, FileText, BookmarkCheck, Sparkles, Search, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const tools = [
  { icon: Search, title: "Find jobs", detail: "Search opportunities posted in TitanOS and review the employer's details.", path: "/hire?tab=browse", cta: "Browse jobs" },
  { icon: Sparkles, title: "Job matches", detail: "Match real listings to your stated skills, preferences and experience.", path: "/hire/matches", cta: "View matches" },
  { icon: FileText, title: "Résumé builder", detail: "Write and format your résumé, then print or export it.", path: "/resume", cta: "Build my résumé" },
  { icon: BookmarkCheck, title: "My applications", detail: "Return to jobs you've applied for and see your existing application records.", path: "/hire?tab=applications", cta: "Track applications" },
  { icon: BriefcaseBusiness, title: "Saved opportunities", detail: "Keep promising positions together while you're searching.", path: "/hire?tab=saved", cta: "See saved jobs" },
  { icon: UserRound, title: "Career profile", detail: "Manage information TitanOS uses when matching you with work.", path: "/profile", cta: "Review profile" },
];

export default function CareerHome() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.full_name || user?.first_name || "";
  return <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 space-y-7" data-testid="career-home">
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-8 sm:p-9">
      <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-primary/10 blur-3xl" aria-hidden="true"/>
      <p className="text-xs uppercase tracking-widest font-bold text-primary">TitanOS • Career Center</p>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">Your next opportunity starts here{displayName ? `, ${displayName.split(" ")[0]}` : ""}.</h1>
      <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mt-3 leading-relaxed">Search for work, improve your résumé and stay organized through applications and interviews. Jobs—not ads—are the entire focus.</p>
      <div className="flex flex-wrap gap-3 mt-6">
        <Link className="inline-flex items-center justify-center min-h-12 gap-2 rounded-lg bg-primary text-primary-foreground font-semibold px-5" to="/hire?tab=browse">Find a job <ArrowRight className="w-4 h-4"/></Link>
        <Link className="inline-flex items-center justify-center min-h-12 gap-2 rounded-lg border border-border bg-background font-semibold px-5" to="/resume">Create résumé <FileText className="w-4 h-4"/></Link>
      </div>
    </section>
    <section aria-labelledby="career-actions-title">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h2 id="career-actions-title" className="text-xl font-bold">What would you like to do?</h2><span className="text-xs text-muted-foreground inline-flex gap-1 items-center"><ShieldCheck className="h-4 w-4"/> No sponsored job placement</span></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((item) => <Link to={item.path} key={item.path} className="group rounded-xl border border-border bg-card hover:border-primary/50 p-5 min-h-[192px] flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><item.icon className="w-5 h-5"/></div>
          <h3 className="font-semibold mt-4">{item.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2 flex-1">{item.detail}</p>
          <span className="inline-flex gap-1 items-center font-semibold text-primary text-sm mt-4">{item.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/></span>
        </Link>)}
      </div>
    </section>
    <p className="text-sm text-muted-foreground border-t border-border pt-5">TitanOS only shows actual job listings returned by its configured sources. When a source is offline or a listing has not been verified, we'll tell you instead of inventing opportunities. Applications are never submitted without your confirmation.</p>
  </div>;
}
