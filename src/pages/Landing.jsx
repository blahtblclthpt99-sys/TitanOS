import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import TitanMark from "@/components/brand/TitanMark";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import ThemeToggle from "@/components/brand/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { hasCachedAuthSession } from "@/lib/sessionPeek";
import Spinner from "@/components/shared/Spinner";

const btn =
  "inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-md px-6 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const btnPrimary = `${btn} bg-primary text-primary-foreground shadow-soft hover:bg-primary/90`;
const btnOutline = `${btn} border border-border bg-card text-foreground shadow-soft hover:bg-muted`;
const btnSm = `${btn} min-h-[40px] h-10 px-4 text-sm bg-primary text-primary-foreground hover:bg-primary/90`;

function Icon({ d, className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  sparkles: "M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z",
  briefcase: "M10 4h4a2 2 0 012 2v2H8V6a2 2 0 012-2zM4 8h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6",
  calc: "M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM8 7h8M8 11h8M8 15h3M13 15h3",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  building: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1",
  wrench: "M14.7 6.3a4 4 0 00-5.4 5.4L3 18.4 5.6 21l6.7-6.3a4 4 0 005.4-5.4l-2.1 2.1-2.9-2.9 2-2.2z",
  map: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10a2 2 0 100-4 2 2 0 000 4z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  check: "M20 6L9 17l-5-5",
  arrow: "M5 12h14M13 5l7 7-7 7",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M18 6L6 18M6 6l12 12",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20V7",
};

const WORKSPACES = [
  {
    icon: "search",
    eyebrow: "Job Seekers",
    title: "Find the next opportunity.",
    desc: "Organize your profile, credentials, opportunities, applications, interviews, and career progress in one workspace.",
    points: ["Opportunity discovery", "Application tracking", "Career profile & credentials"],
    href: "/register",
  },
  {
    icon: "wrench",
    eyebrow: "Independent Work",
    title: "Run the work you win.",
    desc: "Turn opportunities into customers, estimates, scheduled work, invoices, expenses, and a clearer picture of what you earn.",
    points: ["Customers & opportunities", "Estimates, invoices & money", "Mileage, expenses & records"],
    href: "/register",
  },
  {
    icon: "building",
    eyebrow: "Business",
    title: "Operate the whole team.",
    desc: "Coordinate recruiting, employees, scheduling, customers, inventory, fleet activity, field operations, and business workflows.",
    points: ["People & recruiting", "Scheduling & operations", "Fleet, Driver Hub & field tools"],
    href: "/register",
  },
];

const CAPABILITIES = [
  {
    icon: "sparkles",
    title: "Titan AI",
    slug: "titan-ai",
    desc: "Context-aware assistance for work, follow-ups, planning, support, and everyday execution.",
  },
  {
    icon: "briefcase",
    title: "Jobs & opportunities",
    slug: "jobs",
    desc: "Keep career opportunities, applications, work leads, and next actions organized.",
  },
  {
    icon: "calendar",
    title: "Schedule & workflow",
    slug: "schedule",
    desc: "Move from opportunity to scheduled work without losing the details between systems.",
  },
  {
    icon: "calc",
    title: "Money & records",
    slug: "expenses",
    desc: "Track invoices, expenses, mileage, and operational records in the same workspace.",
  },
  {
    icon: "users",
    title: "Customers & teams",
    slug: "customers",
    desc: "Keep the people connected to the work visible, organized, and actionable.",
  },
  {
    icon: "truck",
    title: "Field & fleet tools",
    slug: "driver-hub",
    desc: "Business field operations can use Driver Hub, mileage, route, and fleet workflows where applicable.",
  },
];

const PRINCIPLES = [
  {
    icon: "briefcase",
    title: "Work is the center",
    desc: "TitanOS is organized around finding work, running work, and managing the people and records around it — not around a generic dashboard.",
  },
  {
    icon: "sparkles",
    title: "AI stays in context",
    desc: "Titan AI works with the workspace you are already in so assistance is tied to the task, customer, opportunity, or operation at hand.",
  },
  {
    icon: "shield",
    title: "Clear boundaries",
    desc: "Workspace context does not replace permissions. Sensitive actions, account access, and business capabilities still require authorization.",
  },
];

const PLATFORM_PROOF = [
  { label: "3 workspaces", detail: "Job Seeker · Independent · Business" },
  { label: "One account", detail: "Move between work contexts" },
  { label: "Mobile-first", detail: "Designed for desk and field" },
  { label: "Built-in AI", detail: "Titan AI across workflows" },
];

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function WorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]" aria-label="TitanOS workspace preview">
      <div className="absolute -inset-10 -z-10 rounded-[3rem] bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lift">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <TitanMark className="h-8 w-8" title="TitanOS" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">TitanOS</p>
              <p className="text-sm font-bold tracking-tight text-foreground">Command Center</p>
            </div>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
            Work OS
          </span>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[0.76fr_1.24fr] sm:p-5">
          <div className="space-y-2.5">
            {["Job Seeker", "Independent", "Business"].map((name, index) => (
              <div
                key={name}
                className={`rounded-lg border px-3 py-3 ${
                  index === 0 ? "border-primary/30 bg-primary/10" : "border-border bg-background"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{name}</span>
                  <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  {index === 0 ? "Opportunities & applications" : index === 1 ? "Customers & invoices" : "People & operations"}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-background p-3.5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Titan AI brief</p>
                  <p className="mt-1 text-sm font-bold text-foreground">Your next actions are ready.</p>
                </div>
                <Icon d={ICONS.sparkles} className="h-5 w-5 shrink-0 text-primary" />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Review two new opportunities, follow up on one application, and update an expiring credential.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ["8", "Opportunities"],
                ["3", "Applications"],
                ["2", "Next actions"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border border-border bg-background px-2 py-3 text-center">
                  <div className="text-base font-bold tabular-nums text-foreground">{value}</div>
                  <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-background p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Icon d={ICONS.briefcase} className="h-4 w-4 text-primary" />
                Opportunity pipeline
              </div>
              <div className="mt-3 space-y-2">
                {[
                  ["Delivery Operations", "Interview"],
                  ["Field Service", "Applied"],
                  ["Local Contract", "Review"],
                ].map(([name, state]) => (
                  <div key={name} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-2">
                    <span className="truncate text-[11px] font-medium text-foreground">{name}</span>
                    <span className="shrink-0 text-[10px] font-semibold text-primary">{state}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowBand() {
  const steps = [
    ["Discover", "Find an opportunity or lead"],
    ["Decide", "Track the next action"],
    ["Do", "Run the work or process"],
    ["Record", "Keep the result and history"],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, detail], index) => (
          <div key={title} className="relative border-b border-border p-5 last:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r lg:last:border-r-0">
            <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {index + 1}
            </div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, authChecked, isLoadingAuth } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const menuPanelRef = useRef(null);

  useEffect(() => {
    document.title = "TitanOS — Work, Careers & Business";
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    menuPanelRef.current?.querySelector("a, button")?.focus?.();
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (isAuthenticated || hasCachedAuthSession()) {
    if (!authChecked || isLoadingAuth || !isAuthenticated) {
      return <Spinner fullScreen label="Loading TitanOS" />;
    }
    return null;
  }

  const navItems = [
    ["workspaces", "Workspaces"],
    ["workflow", "How it works"],
    ["capabilities", "Capabilities"],
    ["principles", "Why TitanOS"],
  ];

  const nav = (
    <>
      {navItems.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            scrollToId(id);
            setMenuOpen(false);
          }}
          className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-ring"
        >
          {label}
        </button>
      ))}
      <Link to="/pricing" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-ring">
        Pricing
      </Link>
      <Link to="/download" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-ring">
        Download
      </Link>
      <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-ring">
        Sign in
      </Link>
    </>
  );

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-h-11 items-center gap-2.5 rounded-md focus-ring">
            <TitanMark className="h-9 w-9" title="TitanOS" />
            <div className="leading-none">
              <span className="landing-display block text-base tracking-tight">TitanOS</span>
              <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">Work operating system</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">{nav}</nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden md:flex" />
            <Link to="/register" className={`${btnSm} hidden sm:inline-flex`}>Create account</Link>
            <button
              ref={menuBtnRef}
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border xl:hidden focus-ring"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <Icon d={menuOpen ? ICONS.x : ICONS.menu} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="landing-mobile-nav" ref={menuPanelRef} role="navigation" aria-label="Mobile" className="border-t border-border bg-card px-4 py-4 xl:hidden">
            <div className="flex flex-col gap-1">{nav}</div>
            <div className="mt-3 md:hidden"><ThemeToggle variant="segmented" className="w-full" /></div>
            <Link to="/register" onClick={() => setMenuOpen(false)} className={`${btnPrimary} mt-3 w-full`}>Create account</Link>
          </div>
        )}
      </header>

      <main id="main" tabIndex={-1}>
        <section className="relative overflow-hidden border-b border-border" aria-label="Hero">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 75% 60% at 78% 15%, hsl(var(--primary) / 0.16), transparent 58%), radial-gradient(ellipse 55% 50% at 0% 80%, hsl(var(--primary) / 0.08), transparent 58%), linear-gradient(to bottom, hsl(var(--background)), hsl(var(--muted) / 0.25))",
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.28]"
            style={{
              backgroundImage: "linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)",
              backgroundSize: "52px 52px",
              maskImage: "linear-gradient(to bottom, black 0%, transparent 82%)",
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pb-20 md:pt-16 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16 lg:pb-24 lg:pt-20">
            <div className="landing-rise">
              <div className="mb-6 flex items-center gap-3">
                <TitanBrandLogo layout="stacked" imgClassName="h-14 sm:h-16" />
              </div>
              <p className="landing-eyebrow">One system for finding, doing, and managing work</p>
              <h1 className="landing-display mt-4 max-w-2xl text-4xl leading-[1.04] text-foreground sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
                Find work. Run work. Grow work.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                TitanOS connects career opportunities, independent work, customers, schedules, money, teams, field operations, and Titan AI in one operating system built around the work itself.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/register" className={btnPrimary}>Create your account <Icon d={ICONS.arrow} className="h-4 w-4" /></Link>
                <button type="button" onClick={() => scrollToId("workspaces")} className={btnOutline}>Explore workspaces</button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {["Job seekers", "Independent workers", "Businesses"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />{item}
                  </span>
                ))}
              </div>
            </div>

            <div className="landing-rise" style={{ animationDelay: "90ms" }}>
              <WorkspacePreview />
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/30" aria-label="Platform overview">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border lg:grid-cols-4">
            {PLATFORM_PROOF.map((item) => (
              <div key={item.label} className="bg-background px-4 py-5 sm:px-6">
                <p className="text-sm font-bold text-foreground">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="workspaces" className="landing-section scroll-mt-20 border-b border-border px-4 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="landing-eyebrow">Choose the context that matches the work</p>
              <h2 className="landing-display mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">Three workspaces. One operating system.</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
                TitanOS changes the tools and language around what you are doing without turning each part of your work life into a separate app.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {WORKSPACES.map((workspace) => (
                <Link key={workspace.eyebrow} to={workspace.href} className="group titan-surface titan-surface-interactive flex h-full flex-col p-6 focus-ring sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon d={ICONS[workspace.icon]} />
                    </div>
                    <Icon d={ICONS.arrow} className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-primary">{workspace.eyebrow}</p>
                  <h3 className="landing-display mt-2 text-2xl text-foreground">{workspace.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{workspace.desc}</p>
                  <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
                    {workspace.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-xs text-foreground/80">
                        <Icon d={ICONS.check} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{point}
                      </li>
                    ))}
                  </ul>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-section scroll-mt-20 border-b border-border bg-muted/30 px-4 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="landing-eyebrow">How TitanOS thinks</p>
                <h2 className="landing-display mt-3 text-3xl text-foreground sm:text-4xl">Keep the work moving forward.</h2>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground lg:justify-self-end">
                Opportunity, action, execution, and records belong to the same lifecycle. TitanOS is designed to preserve that continuity instead of scattering it across disconnected tools.
              </p>
            </div>
            <div className="mt-10"><FlowBand /></div>
          </div>
        </section>

        <section id="capabilities" className="landing-section scroll-mt-20 border-b border-border px-4 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="landing-eyebrow">Capabilities</p>
              <h2 className="landing-display mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">Useful tools, connected by context.</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
                The goal is not to add more software to your day. It is to connect the systems you already need around a clearer record of the work.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((capability) => (
                <Link key={capability.title} to={`/features/${capability.slug}`} className="group titan-surface titan-surface-interactive p-5 focus-ring sm:p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon d={ICONS[capability.icon]} className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-foreground">{capability.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{capability.desc}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">Explore <Icon d={ICONS.arrow} className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="principles" className="landing-section scroll-mt-20 border-b border-border bg-muted/30 px-4 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="landing-eyebrow">Why TitanOS</p>
              <h2 className="landing-display mt-3 text-3xl text-foreground sm:text-4xl">Built around work, not software categories.</h2>
            </div>
            <div className="mt-10 grid gap-7 md:grid-cols-3">
              {PRINCIPLES.map((principle) => (
                <div key={principle.title}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon d={ICONS[principle.icon]} /></div>
                  <h3 className="mt-4 text-base font-bold text-foreground">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{principle.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section px-4 sm:px-6">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" aria-hidden="true" />
              <div className="relative max-w-2xl">
                <p className="landing-eyebrow">Start with your next move</p>
                <h2 className="landing-display mt-3 text-3xl text-foreground sm:text-4xl">Bring your work into one system.</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Create an account, choose the workspace that matches what you are doing, and build from there. Current plans and availability are shown on the pricing page.
                </p>
              </div>
              <div className="relative flex flex-wrap gap-3 lg:justify-end">
                <Link to="/register" className={btnPrimary}>Create account <Icon d={ICONS.arrow} className="h-4 w-4" /></Link>
                <Link to="/pricing" className={btnOutline}>View pricing</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2"><TitanMark className="h-6 w-6" />© {new Date().getFullYear()} TitanOS</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/pricing" className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-ring">Pricing</Link>
            <Link to="/download" className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-ring">Download</Link>
            <Link to="/beta" className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-ring">Beta</Link>
            <Link to="/privacy-policy" className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-ring">Privacy</Link>
            <Link to="/terms" className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-ring">Terms</Link>
            <Link to="/login" className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-ring">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
