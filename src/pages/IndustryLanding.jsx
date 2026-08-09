import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import SiteFooter from "@/components/marketing/SiteFooter";
import { Button } from "@/components/ui/button";
import { registrationHref } from "@/lib/marketingAttribution";
import { trackEvent } from "@/lib/productAnalytics";

const INDUSTRIES = {
  handyman: ["Handyman", "Turn calls into scheduled work, keep job notes together, and invoice before leaving the site."],
  cleaning: ["Cleaning", "Coordinate recurring jobs, crews, checklists, customer notes, and payment follow-ups."],
  hvac: ["HVAC", "Connect estimates, equipment notes, schedules, field updates, invoices, and maintenance follow-ups."],
  landscaping: ["Landscaping", "Keep routes, recurring work, crews, expenses, photos, and customer billing in one system."],
  "mobile-repair": ["Mobile Repair", "Run diagnostics, parts runs, mileage, job notes, customer updates, and payments from the field."],
  delivery: ["Delivery", "Measure shifts, stops, mileage, wait time, true costs, and weekly profit without another spreadsheet."],
  hauling: ["Hauling", "Organize loads, drivers, routes, vehicle capacity, job details, expenses, and payout records."],
};

export default function IndustryLanding() {
  const { slug } = useParams();
  const [name, description] = INDUSTRIES[slug] || ["Field Service", "Run customers, jobs, field work, costs, and payments from one connected workspace."];
  useEffect(() => { document.title = `${name} Business Software | TitanOS`; }, [name]);
  const signup = registrationHref({ industry: slug || "field-service" });
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border px-4 py-4"><div className="mx-auto flex max-w-5xl items-center justify-between"><TitanBrandLogo to="/" layout="svg" markClassName="h-9 w-9" /><Link to="/free-tools" className="text-sm text-muted-foreground hover:text-foreground">Profit calculator</Link></div></header>
      <main>
        <section className="border-b border-border px-4 py-16"><div className="mx-auto max-w-5xl"><p className="landing-eyebrow">TitanOS for {name}</p><h1 className="landing-display mt-3 max-w-3xl text-4xl sm:text-6xl">One operating system for your {name.toLowerCase()} business.</h1><p className="mt-5 max-w-2xl text-lg text-muted-foreground">{description}</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild className="min-h-12 px-6"><Link to={signup} onClick={() => trackEvent("cta_clicked", { location: "industry_page", action: "register", industry: slug })}>Create workspace</Link></Button><Button asChild variant="outline" className="min-h-12 px-6"><Link to="/free-tools">Calculate weekly profit</Link></Button></div></div></section>
        <section className="px-4 py-14"><div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">{[["Win work", "Customers, estimates, booking, and follow-ups."], ["Run the day", "Jobs, schedules, notes, routes, mileage, and team communication."], ["Get paid", "Invoices, payment links, expenses, reports, and next-action signals."]].map(([title, text]) => <article key={title} className="titan-surface p-6"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p></article>)}</div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
