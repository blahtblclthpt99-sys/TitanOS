import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Car, Plus, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import DriverDirectory from "@/components/driver/DriverDirectory";
import DriverShiftPanel from "@/components/driver/DriverShiftPanel";

const TABS = [
  { id: "directory", label: "Find drivers", icon: Users },
  { id: "shift", label: "My shift", icon: Car },
];

export default function DriverHub() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const qParam = params.get("q") || "";
  const initialTab = tabParam === "shift" ? "shift" : "directory";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (tabParam === "shift" || tabParam === "directory") setTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (qParam && tab !== "directory") setTab("directory");
  }, [qParam, tab]);

  const selectTab = (id) => {
    setTab(id);
    const next = new URLSearchParams(params);
    next.set("tab", id);
    if (id !== "directory") next.delete("q");
    setParams(next, { replace: true });
  };

  const subtitle = useMemo(
    () =>
      tab === "directory"
        ? "Browse verified drivers by rating, vehicle, availability, and trust — then request or message in one tap."
        : "Hotspots, miles, stops & tax sync for your active shift.",
    [tab]
  );

  return (
    <PageShell maxWidth="xl" className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Driver Hub"
        subtitle={subtitle}
        className="mb-0"
        actions={
          tab === "directory" ? (
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/hire?new=1">
                <Plus className="h-4 w-4" aria-hidden="true" /> Post a haul
              </Link>
            </Button>
          ) : null
        }
      />

      <div
        className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1"
        role="tablist"
        aria-label="Driver Hub sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(id)}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-fast focus-ring ${
                active
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "directory" ? <DriverDirectory initialQuery={qParam} /> : <DriverShiftPanel />}
    </PageShell>
  );
}
