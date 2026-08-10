import React, { Suspense, lazy, useMemo } from "react";
import {
  Car,
  ChartColumn,
  ChevronDown,
  FileText,
  Folder,
  History,
  Layers,
  Map,
  Package,
  Radio,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PageLoader from "@/components/shared/PageLoader";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DRIVER_OS_FOLDERS } from "@/lib/driverOs/folders.js";

const LiveShiftFolder = lazy(() => import("./folders/LiveShiftFolder.jsx"));
const TodaysOrdersFolder = lazy(() => import("./folders/TodaysOrdersFolder.jsx"));
const TripHistoryFolder = lazy(() => import("./folders/TripHistoryFolder.jsx"));
const AnalyticsFolder = lazy(() => import("./folders/AnalyticsFolder.jsx"));
const RushFolder = lazy(() => import("./folders/RushFolder.jsx"));
const PlatformsFolder = lazy(() => import("./folders/PlatformsFolder.jsx"));
const HeatMapsFolder = lazy(() => import("./folders/HeatMapsFolder.jsx"));
const VehicleFolder = lazy(() => import("./folders/VehicleFolder.jsx"));
const ExpensesFolder = lazy(() => import("./folders/ExpensesFolder.jsx"));
const TaxFolder = lazy(() => import("./folders/TaxFolder.jsx"));
const ReportsFolder = lazy(() => import("./folders/ReportsFolder.jsx"));
const SettingsFolder = lazy(() => import("./folders/SettingsFolder.jsx"));
const AiFolder = lazy(() => import("./folders/AiFolder.jsx"));
const PerformanceFolder = lazy(() => import("./folders/PerformanceFolder.jsx"));
const GoalsFolder = lazy(() => import("./folders/GoalsFolder.jsx"));
const MaintenanceFolder = lazy(() => import("./folders/MaintenanceFolder.jsx"));
const DirectoryFolder = lazy(() => import("./folders/DirectoryFolder.jsx"));
const DoorDashFolder = lazy(() => import("./folders/DoorDashFolder.jsx"));

const ICONS = {
  radio: Radio,
  package: Package,
  history: History,
  chart: ChartColumn,
  zap: Zap,
  layers: Layers,
  map: Map,
  car: Car,
  wallet: Wallet,
  file: FileText,
  sheet: FileText,
  settings: Settings,
  sparkles: Sparkles,
  trophy: Trophy,
  target: Target,
  wrench: Wrench,
  users: Users,
};

const FOLDER_BODY = {
  "live-shift": LiveShiftFolder,
  "todays-orders": TodaysOrdersFolder,
  "trip-history": TripHistoryFolder,
  analytics: AnalyticsFolder,
  rush: RushFolder,
  platforms: PlatformsFolder,
  heatmaps: HeatMapsFolder,
  vehicle: VehicleFolder,
  expenses: ExpensesFolder,
  tax: TaxFolder,
  reports: ReportsFolder,
  settings: SettingsFolder,
  ai: AiFolder,
  performance: PerformanceFolder,
  goals: GoalsFolder,
  maintenance: MaintenanceFolder,
  directory: DirectoryFolder,
  doordash: DoorDashFolder,
};

const ACTIVE_FOLDER_IDS = new Set([
  "live-shift",
  "doordash",
  "todays-orders",
  "trip-history",
  "analytics",
  "expenses",
  "goals",
  "vehicle",
  "reports",
  "settings",
  "directory",
]);

function FolderRow({ folder, open, summary, onToggle, children }) {
  const Icon = ICONS[folder.icon] || Folder;
  return (
    <div className="rounded-2xl border border-border bg-card/70 overflow-hidden shadow-soft transition-shadow duration-150">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`driver-os-panel-${folder.id}`}
        className="w-full flex items-center gap-3 px-3.5 py-3.5 min-h-[56px] text-left hover:bg-muted/40 active:bg-muted/55 transition-colors duration-150 focus-ring"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-titan-cyan/10 text-titan-cyan shrink-0">
          <Icon className="w-4 h-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{folder.label}</span>
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            {summary || folder.description}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={`driver-os-panel-${folder.id}`}
          role="region"
          aria-label={folder.label}
          className="border-t border-border px-3 py-3 bg-background/40"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Driver Explorer — expandable intelligence folders (lazy contents).
 */
export default function DriverExplorer({
  user,
  openMap,
  search,
  onToggle,
  onSearchChange,
  summaries = {},
  forceOpenId = null,
  directoryQuery = "",
  refreshTick = 0,
}) {
  const q = String(search || "").trim().toLowerCase();
  const folders = useMemo(() => {
    const active = DRIVER_OS_FOLDERS.filter((folder) => ACTIVE_FOLDER_IDS.has(folder.id));
    if (!q) return active;
    return active.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.id.includes(q) ||
        String(f.group || "").includes(q)
    );
  }, [q]);

  const grouped = useMemo(() => {
    if (q) return [{ id: "search", label: "Results", folders }];
    const groupIds = {
      drive: ["live-shift", "doordash"],
      today: ["todays-orders"],
      records: ["trip-history", "expenses", "reports"],
      insights: ["analytics", "goals"],
      setup: ["vehicle", "directory", "settings"],
    };
    return [
      { id: "drive", label: "Drive", folders: folders.filter((f) => groupIds.drive.includes(f.id)) },
      { id: "today", label: "Today", folders: folders.filter((f) => groupIds.today.includes(f.id)) },
      { id: "records", label: "Records", folders: folders.filter((f) => groupIds.records.includes(f.id)) },
      { id: "insights", label: "Insights", folders: folders.filter((f) => groupIds.insights.includes(f.id)) },
      { id: "setup", label: "Setup", folders: folders.filter((f) => groupIds.setup.includes(f.id)) },
    ].filter((group) => group.folders.length > 0);
  }, [folders, q]);

  return (
    <section aria-label="Driver Explorer" className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-[11px] font-medium text-muted-foreground">Need more info?</p>
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        <p className="text-xs text-muted-foreground">
          Live, history, analytics, and settings — open only what you need. Live status stays pinned above.
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Search folders and deliveries</span>
        <input
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Find a folder or delivery…"
          autoComplete="off"
          enterKeyHint="search"
          className="w-full h-11 rounded-xl border border-border bg-muted px-3 text-sm text-foreground placeholder:text-muted-foreground focus-ring"
        />
      </label>

      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.id} className="space-y-2">
            {!q ? (
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
                {group.label}
              </h3>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {group.folders.map((folder) => {
                const open = Boolean(openMap?.[folder.id] || (forceOpenId && forceOpenId === folder.id));
                const Body = FOLDER_BODY[folder.id];
                return (
                <div key={folder.id} id={`driver-os-folder-${folder.id}`} className={cn(open && "sm:col-span-2")}>
                  <FolderRow
                    folder={folder}
                    open={open}
                    summary={summaries[folder.id]}
                    onToggle={() => onToggle?.(folder.id)}
                  >
                    {open && Body ? (
                      <ErrorBoundary message={`${folder.label} couldn't load. Try refresh.`}>
                        <Suspense fallback={<PageLoader variant="list" label={`Loading ${folder.label}`} />}>
                          <Body user={user} initialQuery={directoryQuery} refreshTick={refreshTick} />
                        </Suspense>
                      </ErrorBoundary>
                    ) : null}
                  </FolderRow>
                </div>
                );
              })}
            </div>
          </div>
        ))}
        {folders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No folders match “{search.trim()}”.</p>
            <button type="button" className="text-sm font-semibold text-primary min-h-[44px] px-3" onClick={() => onSearchChange?.("")}>Clear search</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
