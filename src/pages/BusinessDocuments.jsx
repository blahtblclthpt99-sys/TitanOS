import React from "react";
import { Link } from "react-router";
import { BadgeCheck, FileSignature, Shield } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";

const DOCUMENT_AREAS = [
  {
    title: "Credentials",
    description: "Licenses, certifications, expirations, and work qualifications.",
    path: "/credentials",
    icon: BadgeCheck,
  },
  {
    title: "Contracts",
    description: "Business agreements, signatures, and contract records.",
    path: "/contracts",
    icon: FileSignature,
  },
  {
    title: "Insurance",
    description: "Insurance records, policy details, and expiration tracking.",
    path: "/insurance",
    icon: Shield,
  },
];

export default function BusinessDocuments() {
  return (
    <PageShell maxWidth="xl">
      <PageHeader
        eyebrow="Work"
        title="Business Documents"
        subtitle="Credentials, contracts, and insurance in one compliance workspace."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {DOCUMENT_AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <Link
              key={area.path}
              to={area.path}
              className="group rounded-xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/40 hover:bg-muted/30 focus-ring"
            >
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="font-semibold text-foreground">{area.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{area.description}</p>
              <p className="mt-4 text-sm font-semibold text-primary">Open {area.title}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        TitanOS organizes these records and expiration reminders. Insurance, credential, legal, and compliance requirements remain governed by the applicable provider, employer, contract, and jurisdiction.
      </div>
    </PageShell>
  );
}
