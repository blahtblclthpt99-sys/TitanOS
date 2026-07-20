import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Users,
  Briefcase,
  FileText,
  Calculator,
  Truck,
  Sparkles,
  Calendar,
  MapPin,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Car, title: "Driver Hub", slug: "driver-hub", desc: "Uber, DoorDash & Lyft — start driving, hotspots, miles, fuel & tax sync." },
  { icon: Users, title: "Customers", slug: "customers", desc: "Full profiles, job history, contact details and notes for every client." },
  { icon: Briefcase, title: "Jobs & Dispatch", slug: "jobs", desc: "Create, assign, and track jobs from first call to completion." },
  { icon: FileText, title: "Invoicing", slug: "invoicing", desc: "Professional invoices and estimates — sent in seconds." },
  { icon: Calculator, title: "Expenses & Tax", slug: "expenses", desc: "Log expenses, track mileage, and be ready for tax season." },
  { icon: Truck, title: "Fleet", slug: "fleet", desc: "Manage vehicles, assignments and service records." },
  { icon: Sparkles, title: "Titan AI", slug: "titan-ai", desc: "Your built-in AI assistant — schedule, write, invoice, answer." },
  { icon: Calendar, title: "Schedule", slug: "schedule", desc: "Drag-and-drop scheduling that keeps your whole team on time." },
  { icon: MapPin, title: "Mile Tracker", slug: "mile-tracker", desc: "Automatic mileage logging for every job run." },
];

const TRADES = [
  "Cleaning Services", "HVAC", "Plumbing", "Electrical", "Roofing", "Landscaping",
  "Pest Control", "Pressure Washing", "Mobile Detailing", "Junk Removal", "Handyman",
  "Pool Services", "Appliance Repair", "General Contractors", "Uber / Lyft", "DoorDash / Delivery",
];

const REVIEWS = [
  {
    quote: "I used to spend Sunday evenings doing invoices. Now it takes 10 minutes in the van.",
    name: "Marcus R.",
    role: "Plumbing contractor",
  },
  {
    quote: "The scheduling alone paid for itself in the first week. My team actually shows up on time now.",
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
  "Driver Hub (Uber, DoorDash & more)",
  "Titan AI Assistant",
  "Invoicing & estimates",
  "Expense & tax tracking",
  "Mile tracker",
  "Schedule & dispatch",
  "Fleet management",
  "Reports & analytics",
  "Mobile-first app",
];

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Landing() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {};
  }, []);

  return (
    <div className="min-h-svh bg-[#0A0A0B] text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0A0A0B]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="text-titan-cyan" aria-hidden>⚡</span>
            <span>Titan OS</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <button type="button" onClick={() => scrollToId("features")} className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white">
              Features
            </button>
            <button type="button" onClick={() => scrollToId("pricing")} className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white">
              Pricing
            </button>
            <button type="button" onClick={() => scrollToId("reviews")} className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white">
              Reviews
            </button>
            <Link to="/beta" className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white">
              Beta Program
            </Link>
            <Link to="/download" className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white">
              Download
            </Link>
            <Link to="/login" className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white">
              Sign in
            </Link>
          </nav>
          <Button asChild className="h-9 rounded-xl bg-titan-cyan px-4 text-xs font-bold text-black hover:bg-titan-cyan/85">
            <Link to="/register">Get Started Free</Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,199,217,0.22), transparent 55%), radial-gradient(ellipse 60% 40% at 85% 20%, rgba(124,91,250,0.12), transparent 50%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-titan-cyan/25 bg-titan-cyan/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-titan-cyan">
              Public Beta — Free
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              The AI Operating System
              <span className="block gradient-text">for Service Businesses</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-white/55 sm:text-lg">
              Field service and gig driving in one app — customers, jobs, invoices, plus Uber/DoorDash Driver Hub with miles and tax sync.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild className="h-11 rounded-xl bg-titan-cyan px-5 text-sm font-bold text-black hover:bg-titan-cyan/85">
                <Link to="/register">
                  Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-amber-500/40 bg-amber-500/10 px-4 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 hover:text-amber-200">
                <Link to="/login">
                  <Car className="mr-1.5 h-4 w-4" /> Open Driver Hub
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-white/35">2,400+ businesses already using TitanOS · New: Driver Hub</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative mx-auto w-full max-w-sm"
          >
            <div className="rounded-[1.75rem] border border-white/10 bg-[#121214] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
              <div className="mb-4 flex items-center justify-between text-xs text-white/40">
                <span>9:41</span>
                <span className="font-medium text-white/70">TitanOS</span>
              </div>
              <p className="text-sm text-white/50">Good morning</p>
              <p className="text-xl font-semibold">Marcus 👋</p>
              <div className="mt-4 rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/20 to-transparent p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Car className="h-3.5 w-3.5" /> Driver Hub · NEW
                </div>
                <p className="text-xs text-white/75">Uber · DoorDash · Lyft — start driving</p>
                <p className="mt-1 text-xs text-white/55">Hotspots · miles · fuel · auto tax fill</p>
              </div>
              <div className="mt-3 rounded-2xl border border-titan-cyan/20 bg-titan-cyan/5 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-titan-cyan">
                  <Sparkles className="h-3.5 w-3.5" /> Titan AI · Daily Brief
                </div>
                <p className="text-xs text-white/65">📅 4 jobs today · $1,240 expected revenue</p>
                <p className="mt-1 text-xs text-white/65">🧾 2 invoices overdue — follow up today</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["4", "Today's Jobs"],
                  ["$3.2k", "Revenue"],
                  ["2", "Open"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl bg-white/5 px-2 py-3 text-center">
                    <div className="text-sm font-bold text-titan-cyan">{value}</div>
                    <div className="mt-0.5 text-[10px] text-white/40">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="scroll-mt-16 border-b border-white/5 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-titan-cyan/80">Everything Included</p>
          <h2 className="mt-2 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Every tool your business needs — in one app
          </h2>
          <p className="mt-3 max-w-xl text-white/50">
            No add-ons, no upsells. Everything is included free during beta.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc, slug }) => (
              <Link
                key={title}
                to={`/features/${slug}`}
                className="border-t border-white/10 pt-4 transition-colors hover:border-titan-cyan/40"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-titan-cyan/10 text-titan-cyan">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/45">{desc}</p>
              </Link>
            ))}
          </div>
          <p className="mt-12 text-center text-xs uppercase tracking-widest text-white/30">
            Perfect for every service business
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {TRADES.map((t) => (
              <span key={t} className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/45">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-16 border-b border-white/5 px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-titan-cyan/80">Public Beta</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Free During <span className="gradient-text">Public Beta</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/50">
            TitanOS is completely free while we build and improve the platform together with our early users.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-titan-cyan/25 bg-white/[0.03] p-6 sm:p-8 titan-glow">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Everything Included</h3>
              <p className="text-xs text-white/40">All features, no restrictions</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-titan-cyan">$0</div>
              <p className="text-xs text-white/40">free launch</p>
            </div>
          </div>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-white/60">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-titan-cyan/15">
                  <Check className="h-3 w-3 text-titan-cyan" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-6 h-12 w-full rounded-2xl bg-titan-cyan text-sm font-bold text-black hover:bg-titan-cyan/90">
            <Link to="/register">
              Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-left">
              <p className="text-sm font-semibold">TitanOS for Android</p>
              <p className="text-xs text-white/40">Download the APK directly — no app store needed</p>
            </div>
            <Button asChild className="h-10 flex-shrink-0 rounded-xl bg-titan-cyan px-4 text-xs font-bold text-black hover:bg-titan-cyan/90">
              <Link to="/download">Get App</Link>
            </Button>
          </div>
          <p className="mt-5 text-left text-xs leading-relaxed text-white/40">
            <span className="font-semibold text-white/60">What happens after beta?</span> Premium plans and additional features will be introduced in the future. Early beta users will receive special pricing and perks.
          </p>
          <p className="mt-6 text-center text-xs text-white/30">
            Want to stay in the loop?{" "}
            <Link to="/beta" className="font-medium text-titan-cyan hover:text-titan-cyan/80">
              Join the Beta Program →
            </Link>
          </p>
        </div>
      </section>

      <section id="reviews" className="scroll-mt-16 border-b border-white/5 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight">Loved by the trades</h2>
          <p className="mt-2 text-center text-white/45">Real feedback from real service businesses.</p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {REVIEWS.map((r) => (
              <blockquote key={r.name} className="border-t border-white/10 pt-5">
                <p className="text-sm leading-relaxed text-white/70">&ldquo;{r.quote}&rdquo;</p>
                <footer className="mt-4">
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="text-xs text-white/35">{r.role}</div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start running smarter today</h2>
          <p className="mt-3 text-white/50">
            Join thousands of service businesses — completely free during beta.
          </p>
          <Button asChild className="mt-8 h-12 rounded-2xl bg-titan-cyan px-8 text-sm font-bold text-black hover:bg-titan-cyan/90">
            <Link to="/register">Get Started Free</Link>
          </Button>
          <p className="mt-3 text-xs text-white/30">No credit card · No commitment</p>
        </div>
      </section>

      <footer className="border-t border-white/5 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-white/30">
          <span>© {new Date().getFullYear()} TitanOS</span>
          <div className="flex gap-4">
            <Link to="/download" className="hover:text-white/60">Download</Link>
            <Link to="/beta" className="hover:text-white/60">Beta Program</Link>
            <Link to="/privacy-policy" className="hover:text-white/60">Privacy Policy</Link>
            <Link to="/login" className="hover:text-white/60">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
