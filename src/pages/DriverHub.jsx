import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Brain, Car, Package, Plus, Users, Radio } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import DriverDirectory from "@/components/driver/DriverDirectory";
import DriverShiftPanel from "@/components/driver/DriverShiftPanel";
import DriverLocationPanel from "@/components/driver/DriverLocationPanel";
import DriverIntelligencePanel from "@/components/driver/activity/DriverIntelligencePanel";
import VehicleLogbookPanel from "@/components/driver/activity/VehicleLogbookPanel";
import DoorDashWorkflowPanel from "@/components/driver/activity/DoorDashWorkflowPanel";
import { useAuth } from "@/lib/AuthContext";
import {
  readShiftHistory,
  readSession,
  readStops,
  readPrefs,
  estimateGasPriceUsd,
} from "@/lib/driverHubApi";

const TABS = [
  { id: "shift", label: "My shift", icon: Car, short: "Shift" },
  { id: "doordash", label: "DoorDash", icon: Package, short: "Dash" },
  { id: "intel", label: "Coach", icon: Brain, short: "Coach" },
  { id: "logbook", label: "Logbook", icon: BookOpen, short: "Log" },
  { id: "directory", label: "Find", icon: Users, short: "Find" },
];

export default function DriverHub() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const qParam = params.get("q") || "";
  const allowed = new Set(TABS.map((t) => t.id));
  const initialTab = allowed.has(tabParam) ? tabParam : "shift";
  const [tab, setTab] = useState(initialTab);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (allowed.has(tabParam)) setTab(tabParam);
    else if (!tabParam) setTab("shift");
  }, [tabParam]);

  useEffect(() => {
    if (qParam && tab !== "directory") setTab("directory");
  }, [qParam, tab]);

  useEffect(() => {
    if (tab === "intel" || tab === "logbook") setRefreshTick((t) => t + 1);
  }, [tab]);

  const selectTab = (id) => {
    setTab(id);
    const next = new URLSearchParams(params);
    next.set("tab", id);
    if (id !== "directory") next.delete("q");
    setParams(next, { replace: true });
  };

  const subtitle = useMemo(() => {
    if (tab === "directory") return "Publish yourself or hire nearby drivers.";
    if (tab === "doordash") return "Guided delivery stages · GPS · auto timers.";
    if (tab === "intel") return "All-in $/mi floor · money coach · rush windows.";
    if (tab === "logbook") return "Miles, fuel, expenses, Excel trip reports.";
    return "Miles · money autopilot · voice · Tax Center sync.";
  }, [tab]);

  const prefs = user?.id ? readPrefs(user.id) : {};
  const history = user?.id ? readShiftHistory(user.id) : [];
  const session = user?.id ? readSession(user.id) : null;
  const stops = user?.id ? readStops(user.id) : [];
  const gasUsd = estimateGasPriceUsd(prefs.zip || "");

  return (
    <PageShell maxWidth="xl" className="space-y-4">
      <PageHeader
        eyebrow="Primary"
        title="Driver Hub"
        subtitle={subtitle}
        className="mb-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5 min-h-[44px]">
              <Link to="/comms?channel=tc-dispatch">
                <Radio className="w-3.5 h-3.5" aria-hidden="true" /> Comms
              </Link>
            </Button>
            {tab === "directory" ? (
              <Button asChild size="sm" variant="outline" className="gap-1.5 min-h-[44px]">
                <Link to="/hire?new=1">
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Post a haul
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="gap-1.5 min-h-[44px]">
                <Link to="/driver?tab=directory">
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Publish
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div
        className="grid grid-cols-5 gap-1 rounded-lg border border-border bg-muted p-1"
        role="tablist"
        aria-label="Driver Hub sections"
      >
        {TABS.map(({ id, label, icon: Icon, short }) => {
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
              className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-colors duration-fast focus-ring ${
                active
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{label}</span>
              <span className="lg:hidden text-[10px] sm:text-xs">{short}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`driver-hub-panel-${tab}`} aria-labelledby={`driver-hub-tab-${tab}`}>
        {tab === "directory" ? (
          <DriverDirectory initialQuery={qParam} />
        ) : tab === "doordash" ? (
          <DoorDashWorkflowPanel />
        ) : tab === "logbook" ? (
          <VehicleLogbookPanel
            key={refreshTick}
            userId={user?.id}
            history={history}
            liveSession={session?.active ? session : null}
            stops={stops}
          />
        ) : tab === "intel" ? (
          <DriverIntelligencePanel
            key={refreshTick}
            userId={user?.id}
            history={history}
            liveSession={session?.active ? session : null}
            stops={stops}
            mpg={Number(prefs.mpg) || 22}
            gasUsd={typeof gasUsd === "number" ? gasUsd : 3.5}
            defaultZip={prefs.zip || ""}
          />
        ) : (
          <div className="space-y-4">
            <DriverLocationPanel />
            <DriverShiftPanel />
          </div>
        )}
      </div>
    </PageShell>
  );
}
