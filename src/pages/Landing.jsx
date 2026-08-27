import React, { useEffect } from "react";
import { Link } from "react-router";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import ThemeToggle from "@/components/brand/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { Briefcase, Building2, CalendarDays, CheckCircle2, Compass, ShieldCheck, Sparkles, UserRoundSearch } from "lucide-react";

const primary = "inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const secondary = "inline-flex min-h-[48px] items-center justify-center rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-soft transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const journey = [
  { icon: Compass, title: "Discover", text: "Find jobs and work opportunities that fit your goals, skills, location, and availability." },
  { icon: UserRoundSearch, title: "Match", text: "Compare opportunities against your profile without turning a score into an automatic employment decision." },
  { icon: Sparkles, title: "Prepare", text: "Use TitanAI to strengthen resumes, applications, interview preparation, and career planning." },
  { icon: CalendarDays, title: "Progress", text: "Track applications, interviews, schedules, follow-ups, and the work you land." },
];

const principles = [
  "Jobs, careers, and work opportunities come first.",
  "Sensitive permissions are requested only when a feature actually needs them.",
  "Career recommendations assist people; they do not make hidden hiring decisions.",
  "Business and field tools stay available as secondary tools after you get the work.",
];

export default function Landing() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    document.title = "TitanOS — Jobs, Careers & Work Opportunities";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="TitanOS home" className="flex items-center gap-3">
            <TitanBrandLogo className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link className={primary} to="/jobs">Find jobs</Link>
            ) : (
              <>
                <Link className="hidden text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline-flex" to="/login">Sign in</Link>
                <Link className={primary} to="/register">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-28">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <Briefcase className="h-4 w-4" aria-hidden="true" />
                Career & Work Operating System
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Find the work. Build the career. Keep moving forward.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                TitanOS brings job discovery, career matching, applications, interview preparation, scheduling, career profiles, and practical work tools into one focused system.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className={primary} to={isAuthenticated ? "/jobs" : "/register"}>
                  Find opportunities
                </Link>
                <Link className={secondary} to={isAuthenticated ? "/profile" : "/login"}>
                  Build career profile
                </Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                TitanOS supports decisions; employers and job seekers remain in control of employment choices.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Career command center</p>
                  <h2 className="mt-2 text-2xl font-bold">Your next best move</h2>
                </div>
                <Sparkles className="h-7 w-7 text-primary" aria-hidden="true" />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  ["Jobs", "Search and save opportunities"],
                  ["Matches", "See why an opportunity may fit"],
                  ["Profile", "Keep skills and credentials organized"],
                  ["TitanAI", "Prepare applications and interviews"],
                ].map(([title, text]) => (
                  <div key={title} className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-primary" aria-hidden="true" />
                    <div><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">The TitanOS path</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">From searching to working</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {journey.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-[0.16em]">Built around trust</span>
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Focused functionality, not permission sprawl.</h2>
              <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
                TitanOS is being structured so jobs and career progression remain the core experience. Location, contacts, camera, files, notifications, and other sensitive capabilities should be requested only when a user deliberately starts a feature that needs them.
              </p>
            </div>
            <div className="space-y-3">
              {principles.map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-primary" aria-hidden="true" />
                  <p className="text-sm leading-6">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
            <div>
              <div className="flex items-center gap-2 text-primary"><Building2 className="h-5 w-5" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Work after the hire</span></div>
              <h2 className="mt-2 text-2xl font-black">TitanOS still grows with the work you get.</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">Scheduling, field work, customers, estimates, invoices, mileage, business records, and fleet tools remain available as supporting capabilities—not as distractions from the core career mission.</p>
            </div>
            <Link className={`${secondary} mt-6 lg:mt-0`} to={isAuthenticated ? "/more" : "/register"}>Explore TitanOS</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 TitanOS · Jobs, careers and work opportunities</span>
          <div className="flex gap-4"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/delete-account">Delete account</Link></div>
        </div>
      </footer>
    </div>
  );
}
