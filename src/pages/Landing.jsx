import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import TitanMark from "@/components/brand/TitanMark";

const btn =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-[48px] px-6";
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
  car: "M5 17h14v2H5zM7 17l1.5-6h7L17 17M5 11l1-4h12l1 4",
  building: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1",
  wrench: "M14.7 6.3a4 4 0 00-5.4 5.4L3 18.4 5.6 21l6.7-6.3a4 4 0 005.4-5.4l-2.1 2.1-2.9-2.9 2-2.2z",
  map: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10a2 2 0 100-4 2 2 0 000 4z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  check: "M20 6L9 17l-5-5",
  arrow: "M5 12h14M13 5l7 7-7 7",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M18 6L6 18M6 6l12 12",
  star: "M12 2l2.9 6.9L22 10l-5 4.4L18.2 22 12 18.2 5.8 22 7 14.4 2 10l7.1-1.1L12 2z",
};

const FEATURES = [
  { icon: "sparkles", title: "Titan AI", slug: "titan-ai", desc: "Briefs, notes, and follow-ups written for you between stops." },
  { icon: "briefcase", title: "Jobs & dispatch", slug: "jobs", desc: "From first call to done — assign, track, and close out." },
  { icon: "users", title: "Customers", slug: "customers", desc: "History and notes so every visit starts informed." },
  { icon: "file", title: "Invoicing", slug: "invoicing", desc: "Estimates and invoices that look professional, sent in seconds." },
  { icon: "calc", title: "Expenses & tax", slug: "expenses", desc: "Receipts, mileage, and write-offs ready for tax season." },
  { icon: "calendar", title: "Schedule", slug: "schedule", desc: "A clear week view that keeps crews on time." },
  { icon: "truck", title: "Fleet", slug: "fleet", desc: "Vehicles, assignments, and service records in one place." },
  { icon: "car", title: "Driver Hub", slug: "driver-hub", desc: "Hire help or run shifts with miles logged for tax." },
];

const AUDIENCES = [
  {
    icon: "building",
    title: "Owners & operators",
    desc: "See jobs, money, and team status without living in a spreadsheet.",
    href: "/register",
  },
  {
    icon: "wrench",
    title: "Technicians",
    desc: "Job details, checklists, and invoices from the van — not the office.",
    href: "/register",
  },
  {
    icon: "car",
    title: "Drivers",
    desc: "Find hauling work or run gig shifts with miles ready for tax.",
    href: "/register",
  },
];

const WHY = [
  {
    icon: "sparkles",
    title: "One app, not five",
    desc: "Jobs, customers, schedule, money, and AI share the same workspace — so nothing falls through the cracks.",
  },
  {
    icon: "map",
    title: "Built for the field",
    desc: "Mobile-first screens that work between stops, not only at a desk with a mouse.",
  },
  {
    icon: "shield",
    title: "Free while we grow",
    desc: "Public beta unlocks the full product. Early users get founder pricing later.",
  },
];

const TRUST = [
  { label: "Public beta", detail: "Full product access" },
  { label: "No credit card", detail: "Start in minutes" },
  { label: "Android app", detail: "Install the APK" },
  { label: "Field-ready", detail: "Mobile-first design" },
];

const REVIEWS = [
  {
    quote: "I used to spend Sunday evenings doing invoices. Now it takes ten minutes in the van.",
    name: "Marcus R.",
    role: "Plumbing contractor",
  },
  {
    quote: "Scheduling alone paid for itself in the first week. My team actually shows up on time.",
    name: "Sarah K.",
    role: "Electrical business owner",
  },
  {
    quote: "Titan AI writes my job notes faster than I can type. Complete game changer.",
    name: "James T.",
    role: "HVAC technician",
  },
];

const INCLUDED = [
  "Unlimited customers & jobs",
  "Titan AI Assistant",
  "Invoicing & estimates",
  "Expense & tax tracking",
  "Mile tracker",
  "Schedule & dispatch",
  "Fleet management",
  "Reports & analytics",
  "Driver marketplace",
  "Mobile-first app",
];

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Phone-frame product illustration — reads as a real Command Center screenshot. */
function ProductPreview() {
  return (
    <div
      className="landing-phone relative mx-auto w-full max-w-[320px] sm:max-w-[360px]"
      aria-label="TitanOS Command Center preview"
    >
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" aria-hidden="true" />
      <div className="overflow-hidden rounded-[1.75rem] border-[5px] border-foreground/90 bg-foreground shadow-lift">
        <div className="bg-background">
          <div className="flex items-center justify-center bg-foreground px-4 pb-2 pt-3">
            <span className="h-1.5 w-16 rounded-full bg-background/30" aria-hidden="true" />
          </div>
          <div className="space-y-3 bg-[hsl(210_25%_96%)] p-3.5 dark:bg-[hsl(222_20%_8%)]">
            <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-2" aria-hidden="true">
                  <TitanMark className="h-8 w-8" title="TitanOS" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">TitanOS</p>
                  <p className="text-sm font-bold tracking-tight text-foreground">Command Center</p>
                </div>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Live</span>
            </div>

            <div className="rounded-md border border-primary/20 bg-card p-3 shadow-soft">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                <Icon d={ICONS.sparkles} className="h-3 w-3" />
                Titan AI · Daily brief
              </div>
              <p className="text-xs font-medium text-foreground">4 jobs today · $1,240 expected</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">2 invoices need a follow-up</p>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                ["4", "Jobs"],
                ["$3.2k", "This week"],
                ["98", "Score"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-md border border-border bg-card px-1.5 py-2.5 text-center shadow-soft">
                  <div className="text-sm font-bold tabular-nums text-foreground">{value}</div>
                  <div className="mt-0.5 text-[9px] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-border bg-card p-3 shadow-soft">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Icon d={ICONS.briefcase} className="h-3.5 w-3.5 text-primary" />
                Next up
              </div>
              <p className="text-xs text-foreground/90">10:30 · Smith HVAC install</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Midtown · estimate signed</p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-2/3 rounded-full bg-primary" />
              </div>
            </div>

            <div className="flex gap-1.5">
              {["Jobs", "Schedule", "Money"].map((tab, i) => (
                <div
                  key={tab}
                  className={`flex-1 rounded-md px-1 py-2 text-center text-[10px] font-semibold ${
                    i === 0 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Wide product strip — desk + field context without looking like a card collage. */
function FieldShowcase() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-lift">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, transparent 42%), linear-gradient(to top, hsl(var(--card)) 0%, transparent 55%)",
        }}
        aria-hidden="true"
      />
      <div className="relative grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b border-border p-5 md:border-b-0 md:border-r md:p-8">
          <p className="landing-eyebrow">In the app</p>
          <h3 className="landing-display mt-2 text-2xl text-foreground sm:text-3xl">
            Your day, one screen.
          </h3>
          <ul className="mt-6 space-y-3">
            {[
              "Open the day with a Titan AI brief",
              "Dispatch jobs and see crew status",
              "Send invoices before you leave the driveway",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground/85">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Icon d={ICONS.check} className="h-3 w-3 text-primary" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-end justify-center bg-muted/40 px-4 pb-0 pt-6 md:pt-8">
          <div className="w-full max-w-[240px] translate-y-2 md:max-w-[260px]">
            <ProductPreview />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const menuPanelRef = useRef(null);

  useEffect(() => {
    document.title = "TitanOS — AI OS for Service Businesses";
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const first = menuPanelRef.current?.querySelector("a, button");
    first?.focus?.();
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const nav = (
    <>
      {[
        ["what", "What it is"],
        ["who", "Who it's for"],
        ["why", "Why TitanOS"],
        ["features", "Features"],
        ["pricing", "Pricing"],
      ].map(([id, label]) => (
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
      <Link
        to="/download"
        onClick={() => setMenuOpen(false)}
        className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-ring"
      >
        Download
      </Link>
      <Link
        to="/login"
        onClick={() => setMenuOpen(false)}
        className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-ring"
      >
        Sign in
      </Link>
    </>
  );

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5 rounded-md focus-ring">
            <TitanMark className="h-9 w-9" title="TitanOS" />
            <span className="landing-display text-base tracking-tight">TitanOS</span>
          </Link>
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {nav}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/register" className={`${btnSm} hidden sm:inline-flex`}>
              Get started free
            </Link>
            <button
              ref={menuBtnRef}
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border lg:hidden focus-ring"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon d={menuOpen ? ICONS.x : ICONS.menu} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div
            id="landing-mobile-nav"
            ref={menuPanelRef}
            role="navigation"
            aria-label="Mobile"
            className="border-t border-border bg-card px-4 py-3 lg:hidden"
          >
            <div className="flex flex-col gap-1">{nav}</div>
            <Link to="/register" onClick={() => setMenuOpen(false)} className={`${btnPrimary} mt-3 w-full`}>
              Get started free
            </Link>
          </div>
        )}
      </header>

      <main id="main" tabIndex={-1}>
        {/* Hero — brand + value + CTA + dominant product visual */}
        <section className="relative overflow-hidden border-b border-border" aria-label="Hero">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 100% 70% at 50% -20%, hsl(var(--primary) / 0.16), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 60%, hsl(var(--primary) / 0.06), transparent 50%), linear-gradient(to bottom, hsl(var(--background)), hsl(210 22% 94%))",
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:pb-20 md:pt-16">
            <div className="landing-rise">
              <div className="mb-5 flex items-center gap-3">
                <TitanMark className="h-14 w-14 sm:h-16 sm:w-16" title="TitanOS" />
                <div>
                  <p className="landing-display text-3xl tracking-tight text-foreground sm:text-4xl">TitanOS</p>
                  <p className="text-caption font-semibold text-primary">Public beta · Free to start</p>
                </div>
              </div>
              <h1 className="landing-display max-w-xl text-3xl text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
                The operating system for service businesses.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Jobs, customers, invoices, schedule, and Titan AI in one mobile-first app — built for owners,
                techs, and drivers who work in the field.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/register" className={btnPrimary}>
                  Get started free <Icon d={ICONS.arrow} className="h-4 w-4" />
                </Link>
                <button type="button" onClick={() => scrollToId("what")} className={btnOutline}>
                  See what it does
                </button>
              </div>
              <p className="mt-5 text-caption text-muted-foreground">
                No credit card · Full product during public beta
              </p>
            </div>

            <div className="landing-rise flex justify-center md:justify-end" style={{ animationDelay: "90ms" }}>
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="border-b border-border bg-muted/40" aria-label="Trust indicators">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {TRUST.map((t) => (
              <div key={t.label} className="bg-background px-4 py-5 text-center sm:px-6 sm:text-left">
                <p className="text-sm font-semibold text-foreground">{t.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What is TitanOS */}
        <section id="what" className="landing-section scroll-mt-16 border-b border-border px-4">
          <div className="mx-auto max-w-6xl">
            <p className="landing-eyebrow">What is TitanOS?</p>
            <h2 className="landing-display mt-2 max-w-3xl text-3xl text-foreground sm:text-4xl">
              One place to run the business — from the first call to the paid invoice.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              TitanOS replaces the patchwork of texts, spreadsheets, and separate apps most service teams juggle.
              Open one Command Center and see today&apos;s jobs, money, and next moves.
            </p>
            <div className="mt-10">
              <FieldShowcase />
            </div>
          </div>
        </section>

        {/* Who */}
        <section id="who" className="landing-section scroll-mt-16 border-b border-border bg-muted/30 px-4">
          <div className="mx-auto max-w-6xl">
            <p className="landing-eyebrow">Who it&apos;s for</p>
            <h2 className="landing-display mt-2 text-3xl text-foreground sm:text-4xl">
              Built for people who work with their hands — and run a business.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {AUDIENCES.map(({ icon, title, desc, href }) => (
                <Link
                  key={title}
                  to={href}
                  className="titan-surface titan-surface-interactive block p-5 focus-ring"
                >
                  <Icon d={ICONS[icon]} className="mb-3 h-6 w-6 text-primary" />
                  <h3 className="text-heading text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Start free <Icon d={ICONS.arrow} className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Why */}
        <section id="why" className="landing-section scroll-mt-16 border-b border-border px-4">
          <div className="mx-auto max-w-6xl">
            <p className="landing-eyebrow">Why TitanOS</p>
            <h2 className="landing-display mt-2 max-w-2xl text-3xl text-foreground sm:text-4xl">
              Why teams switch from spreadsheets and generic CRMs.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {WHY.map(({ icon, title, desc }) => (
                <div key={title} className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon d={ICONS[icon]} />
                  </div>
                  <h3 className="text-heading text-foreground">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="landing-section scroll-mt-16 border-b border-border bg-muted/30 px-4">
          <div className="mx-auto max-w-6xl">
            <p className="landing-eyebrow">Features</p>
            <h2 className="landing-display mt-2 max-w-xl text-3xl text-foreground sm:text-4xl">
              Everything you need to run the day — included.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              No add-ons or paywalls during public beta. Tap a feature to learn more.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon, title, desc, slug }) => (
                <Link
                  key={title}
                  to={`/features/${slug}`}
                  className="titan-surface titan-surface-interactive block p-4 focus-ring"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon d={ICONS[icon]} className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="reviews" className="landing-section scroll-mt-16 border-b border-border px-4" aria-label="Testimonials">
          <div className="mx-auto max-w-6xl">
            <p className="landing-eyebrow text-center">From the field</p>
            <h2 className="landing-display mt-2 text-center text-3xl text-foreground">
              What early users are saying
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
              Placeholder quotes from beta testers — real stories coming as we grow.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {REVIEWS.map((r) => (
                <blockquote key={r.name} className="titan-surface flex flex-col p-5">
                  <div className="mb-3 flex gap-0.5 text-primary" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Icon key={i} d={ICONS.star} className="h-3.5 w-3.5 fill-primary/20" />
                    ))}
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-foreground/85">&ldquo;{r.quote}&rdquo;</p>
                  <footer className="mt-5 border-t border-border pt-4">
                    <div className="text-sm font-semibold text-foreground">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.role}</div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing / next step */}
        <section id="pricing" className="landing-section scroll-mt-16 border-b border-border bg-muted/30 px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="landing-eyebrow">What to do next</p>
            <h2 className="landing-display mt-2 text-3xl text-foreground sm:text-4xl">
              Start free. Run your next job on TitanOS.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Create an account in minutes. Full product during public beta — no card required.
            </p>
          </div>
          <div className="titan-surface mx-auto mt-10 max-w-lg p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="text-left">
                <h3 className="text-xl font-bold text-foreground">Everything included</h3>
                <p className="text-xs text-muted-foreground">All features · no restrictions</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold tabular-nums text-primary">$0</div>
                <p className="text-xs text-muted-foreground">during beta</p>
              </div>
            </div>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Icon d={ICONS.check} className="h-3 w-3 text-primary" />
                  </span>
                  <span className="text-foreground/80">{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/register" className={`${btnPrimary} mt-6 w-full`}>
              Create your free account <Icon d={ICONS.arrow} className="h-4 w-4" />
            </Link>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-4">
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Prefer Android?</p>
                <p className="text-xs text-muted-foreground">Download the APK — no store required</p>
              </div>
              <Link to="/download" className={`${btnOutline} h-10 min-h-[40px] flex-shrink-0 px-3 text-xs`}>
                Get app
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="landing-section px-4">
          <div className="mx-auto max-w-3xl text-center">
            <TitanMark className="mx-auto h-14 w-14" title="TitanOS" />
            <h2 className="landing-display mt-4 text-3xl text-foreground sm:text-4xl">
              Ready when you are.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Join service businesses running jobs on TitanOS — free during public beta.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/register" className={btnPrimary}>
                Get started free
              </Link>
              <Link to="/login" className={btnOutline}>
                Sign in
              </Link>
            </div>
            <p className="mt-3 text-caption text-muted-foreground">No credit card · No commitment</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <TitanMark className="h-6 w-6" />© {new Date().getFullYear()} TitanOS
          </span>
          <div className="flex flex-wrap gap-4">
            <Link to="/download" className="rounded-md hover:text-foreground focus-ring">
              Download
            </Link>
            <Link to="/pricing" className="rounded-md hover:text-foreground focus-ring">
              Pricing
            </Link>
            <Link to="/beta" className="rounded-md hover:text-foreground focus-ring">
              Beta
            </Link>
            <Link to="/privacy-policy" className="rounded-md hover:text-foreground focus-ring">
              Privacy
            </Link>
            <Link to="/login" className="rounded-md hover:text-foreground focus-ring">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
