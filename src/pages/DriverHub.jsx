import React from "react";
import { Link } from "react-router";
import {
  Briefcase,
  Calendar,
  MapPinned,
  Truck,
  UserRoundCog,
} from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";

const FLEET_WORKSPACES = [
  {
    title: "Vehicles & equipment",
    description: "Track vehicles, service dates, warranties, and the assets your business depends on.",
    path: "/fleet",
    icon: Truck,
  },
  {
    title: "Employees",
    description: "Manage the people who drive, operate equipment, and complete field work.",
    path: "/employees",
    icon: UserRoundCog,
  },
  {
    title: "Assigned work",
    description: "Keep fleet activity tied to real jobs instead of a separate driver-only workflow.",
    path: "/jobs",
    icon: Briefcase,
  },
  {
    title: "Route planning",
    description: "Plan efficient routes for scheduled business work and fleet assignments.",
    path: "/routes",
    icon: MapPinned,
  },
  {
    title: "Schedule",
    description: "See when work is happening before assigning people or vehicles.",
    path: "/schedule",
    icon: Calendar,
  },
];

export default function DriverHub() {
  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader
        eyebrow="Business Management"
        title="Fleet Operations"
        subtitle="A focused business workspace for managing drivers, vehicles, routes, and assigned jobs."
      />

      <section className="titan-surface p-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Fleet-only subsystem</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Drivers support the business. They are not a separate operating system.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            TitanOS keeps driver activity connected to employees, vehicles, scheduled jobs, and routes. Consumer delivery-app telemetry, oversized driver dashboards, and unrelated gig-work controls are intentionally excluded from this business workspace.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Fleet management workspaces">
        {FLEET_WORKSPACES.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="titan-surface titan-surface-interactive min-h-[150px] p-5 focus-ring"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-semibold text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </Link>
          );
        })}
      </section>
    </PageShell>
  );
}
