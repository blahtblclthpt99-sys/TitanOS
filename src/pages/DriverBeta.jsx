import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CheckCircle2, MessageSquare, Route } from "lucide-react";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import SiteFooter from "@/components/marketing/SiteFooter";
import { Button } from "@/components/ui/button";
import { registrationHref } from "@/lib/marketingAttribution";
import { trackEvent } from "@/lib/productAnalytics";

const WINS = [
  { icon: Route, title: "Run one real shift", text: "Track time, mileage, stops, and the work that normally disappears between payouts." },
  { icon: BarChart3, title: "See true weekly profit", text: "Compare earnings with mileage and operating costs instead of relying on gross payout." },
  { icon: MessageSquare, title: "Shape what ships next", text: "Report friction and share a measurable result. Positive feedback is never required." },
];

export default function DriverBeta() {
  useEffect(() => {
    document.title = "Free Driver Beta | TitanOS";
    trackEvent("cohort_page_view", { cohort: "driver_first_10" });
  }, []);

  const signup = registrationHref({ cohort: "driver_first_10", first_win: "driver_shift", from_url: "/driver" });

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <TitanBrandLogo to="/" layout="svg" markClassName="h-9 w-9" />
          <Link to="/free-tools" className="text-sm text-muted-foreground hover:text-foreground">Free profit calculator</Link>
        </div>
      </header>
      <main>
        <section className="border-b border-border px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="landing-eyebrow">Seeking 10 active founding testers</p>
            <h1 className="landing-display mt-3 max-w-4xl text-4xl sm:text-6xl">Find out what your delivery shift actually paid you.</h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">Use TitanOS free during public beta. Run real shifts, identify hidden costs, and help build a driver-first operating system.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="min-h-12 px-6">
                <Link to={signup} onClick={() => trackEvent("cohort_apply_start", { cohort: "driver_first_10" })}>Join the free cohort <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="min-h-12 px-6"><Link to="/free-tools">Calculate profit first</Link></Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No credit card · No required positive review · Honest feedback expected</p>
          </div>
        </section>
        <section className="px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="landing-display text-3xl">Your first three steps</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {WINS.map(({ icon: Icon, title, text }) => <article key={title} className="titan-surface p-6"><Icon className="h-6 w-6 text-primary" /><h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></article>)}
            </div>
            <div className="mt-8 rounded-xl border border-border bg-muted/30 p-6">
              <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-400" /> What success looks like</p>
              <p className="mt-2 text-sm text-muted-foreground">Complete one shift, review the profit result, return within seven days, and tell us what helped or failed. If TitanOS produces a measurable benefit, you can optionally submit it for verification on the beta page.</p>
              <Link to="/beta" className="mt-4 inline-flex text-sm font-semibold text-primary">Open feedback and success stories →</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
