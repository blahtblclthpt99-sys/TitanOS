import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Car, Plus, Users, Radio } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import DriverDirectory from "@/components/driver/DriverDirectory";
import DriverShiftPanel from "@/components/driver/DriverShiftPanel";
import DriverLocationPanel from "@/components/driver/DriverLocationPanel";

const TABS = [
  { id: "directory", label: "Find drivers", icon: Users },
  { id: "shift", label: "My shift", icon: Car },
];

export default function DriverHub() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const qParam = params.get("q") || "";
  const initialTab = tabParam === "directory" ? "directory" : "shift";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (tabParam === "shift" || tabParam === "directory") setTab(tabParam);
    else if (!tabParam) setTab("shift");
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
        ? "Browse published drivers nearby — or publish yourself to get hired."
        : "Track miles, stops, fuel, and sync to Tax Center.",
    [tab]
  );

  return (
    <PageShell maxWidth="xl" className="space-y-5">
      <PageHeader
        eyebrow="Field"
        title="Driver Hub"
        subtitle={subtitle}
        className="mb-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/comms?channel=tc-dispatch">
                <Radio className="h-4 w-4" aria-hidden="true" /> TitanComms
              </Link>
            </Button>
            {tab === "directory" ? (
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link to="/hire?new=1">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Post a haul
                </Link>
              </Button>
            ) : null}
          </div>
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
              id={`driver-hub-tab-${id}`}
              aria-controls={`driver-hub-panel-${id}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
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

      <div
        role="tabpanel"
        id={`driver-hub-panel-${tab}`}
        aria-labelledby={`driver-hub-tab-${tab}`}
      >
        {tab === "directory" ? <DriverDirectory initialQuery={qParam} /> : (
          <div className="space-y-4">
            <DriverLocationPanel />
            <DriverShiftPanel />
          </div>
        )}
      </div>
    </PageShell>
  );
}
