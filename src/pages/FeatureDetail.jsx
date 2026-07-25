import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import SiteFooter from "@/components/marketing/SiteFooter";

const FEATURES = {
  customers: {
    title: "Customers",
    desc: "Full profiles, job history, contact details and notes for every client — searchable from the van or the office.",
  },
  jobs: {
    title: "Jobs & Dispatch",
    desc: "Create, assign, and track jobs from first call to completion with live status for your whole team.",
  },
  invoicing: {
    title: "Invoicing",
    desc: "Professional invoices and estimates — built from jobs in seconds and ready to send.",
  },
  expenses: {
    title: "Expenses & Tax",
    desc: "Log expenses, track mileage, and stay ready for tax season without a shoe-box of receipts.",
  },
  fleet: {
    title: "Fleet",
    desc: "Manage vehicles, assignments, and service records so trucks stay on the road.",
  },
  "titan-ai": {
    title: "Titan AI",
    desc: "Your built-in AI assistant — schedule, write notes, draft invoices, and answer on the job.",
  },
  schedule: {
    title: "Schedule",
    desc: "Drag-and-drop scheduling that keeps every tech on time and every job visible.",
  },
  "mile-tracker": {
    title: "Mile Tracker",
    desc: "Automatic mileage logging for every job run — audit-ready when you need it.",
  },
  "driver-hub": {
    title: "Driver Hub",
    desc: "Find verified drivers by CDL, vehicle, route, and rating — plus track your own shift, miles, and tax sync.",
  },
};

export default function FeatureDetail() {
  const { slug } = useParams();
  const feature = FEATURES[slug] || {
    title: "TitanOS Feature",
    desc: "Everything you need to run a field service business — included free during public beta.",
  };

  return (
    <div className="min-h-svh bg-background text-foreground flex flex-col">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <TitanBrandLogo to="/" layout="svg" markClassName="h-10 w-10" className="mb-8" />
        <h1 className="text-3xl font-bold tracking-tight">{feature.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
        <Button asChild className="mt-8 h-12 rounded-2xl px-6 text-sm font-bold">
          <Link to="/register">
            Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <div className="mt-4">
          <Link to="/#features" className="text-xs text-muted-foreground hover:text-foreground">
            ← All features
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
