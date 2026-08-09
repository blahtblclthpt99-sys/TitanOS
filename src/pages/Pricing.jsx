import React from "react";
import { Link } from "react-router-dom";
import { Check, Download, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/marketing/SiteFooter";
import { openPlayStore } from "@/lib/app-download";

const INCLUDED = [
  "Jobs, scheduling, customers, estimates, and invoices",
  "Driver Hub, mileage, expenses, and field workflows",
  "Titan AI, reports, communication, and marketplace tools",
  "Teams, fleet, files, settings, and administration",
];

export default function Pricing() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <main className="flex flex-1 items-center px-4 py-12">
        <div className="mx-auto w-full max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Rocket className="h-4 w-4" aria-hidden="true" /> TitanOS access
          </div>
          <h1 className="landing-display text-4xl sm:text-5xl">One complete field operating system.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Create your workspace and use the complete TitanOS toolkit from the web or Android app.
          </p>
          <section className="titan-surface mx-auto mt-10 max-w-2xl p-6 text-left sm:p-8" aria-label="Included tools">
            <h2 className="text-xl font-bold">Included in your workspace</h2>
            <ul className="mt-5 space-y-4">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground/85">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-h-12"><Link to="/register">Create workspace</Link></Button>
            <Button type="button" size="lg" variant="outline" className="min-h-12" onClick={openPlayStore}>
              <Download className="h-4 w-4" aria-hidden="true" /> Get Android app
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
