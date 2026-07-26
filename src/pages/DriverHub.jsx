import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, WifiOff } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import MissionControl from "@/components/driver/os/MissionControl";
import DriverExplorer from "@/components/driver/os/DriverExplorer";
import { useAuth } from "@/lib/AuthContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import {
  readExplorerState,
  writeExplorerState,
  toggleFolderOpen,
  setExplorerSearch,
} from "@/lib/driverOs/explorerState.js";
import { buildFolderSummaries, searchDeliveries } from "@/lib/driverOs/search.js";
import { folderById } from "@/lib/driverOs/folders.js";
import { cn } from "@/lib/utils";

/** Map legacy ?tab= links into Driver OS folders. */
const TAB_TO_FOLDER = {
  shift: "live-shift",
  doordash: "doordash",
  intel: "analytics",
  logbook: "expenses",
  directory: "directory",
};

export default function DriverHub() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const folderParam = params.get("folder");
  const qParam = params.get("q") || "";
  const [refreshTick, setRefreshTick] = useState(0);
  const [forceOpenId, setForceOpenId] = useState(null);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );

  const explorer = useMemo(() => {
    void refreshTick;
    return user?.id ? readExplorerState(user.id) : { open: { "live-shift": true }, search: "" };
  }, [user?.id, refreshTick]);

  const [openMap, setOpenMap] = useState(explorer.open);
  const [search, setSearch] = useState(explorer.search || "");

  useEffect(() => {
    setOpenMap(explorer.open);
    setSearch(explorer.search || "");
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate once per user

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Deep-link: ?folder= or legacy ?tab=
  useEffect(() => {
    const target =
      (folderParam && folderById(folderParam)?.id) ||
      (tabParam && TAB_TO_FOLDER[tabParam]) ||
      null;
    if (!target) return;
    setForceOpenId(target);
    setOpenMap((prev) => {
      const next = { ...prev, [target]: true };
      if (user?.id) writeExplorerState(user.id, { open: next, search });
      return next;
    });
  }, [folderParam, tabParam, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!qParam) return;
    setSearch(qParam);
    if (user?.id) setExplorerSearch(user.id, qParam);
    setForceOpenId("directory");
    setOpenMap((prev) => ({ ...prev, directory: true }));
  }, [qParam, user?.id]);

  // Debounced persist of search text
  useEffect(() => {
    if (!user?.id) return undefined;
    const id = window.setTimeout(() => setExplorerSearch(user.id, search), 350);
    return () => window.clearTimeout(id);
  }, [search, user?.id]);

  const summaries = useMemo(() => {
    void refreshTick;
    try {
      return buildFolderSummaries(user?.id);
    } catch {
      return {};
    }
  }, [user?.id, refreshTick]);

  const deliveryHits = useMemo(() => {
    void refreshTick;
    if (!user?.id || !search.trim() || search.trim().length < 2) return [];
    try {
      return searchDeliveries(user.id, search);
    } catch {
      return [];
    }
  }, [user?.id, search, refreshTick]);

  const onToggle = useCallback(
    (id) => {
      if (!user?.id) {
        setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
        setForceOpenId(null);
        return;
      }
      const next = toggleFolderOpen(user.id, id);
      setOpenMap(next.open);
      setForceOpenId(null);
      const p = new URLSearchParams(params);
      if (next.open[id]) p.set("folder", id);
      else p.delete("folder");
      p.delete("tab");
      setParams(p, { replace: true });
    },
    [user?.id, params, setParams]
  );

  const onSearchChange = useCallback((value) => {
    setSearch(value);
  }, []);

  const onOpenFolder = useCallback(
    (id) => {
      setForceOpenId(id);
      setOpenMap((prev) => {
        const next = { ...prev, [id]: true };
        if (user?.id) writeExplorerState(user.id, { open: next, search });
        return next;
      });
      requestAnimationFrame(() => {
        document.getElementById(`driver-os-folder-${id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [user?.id, search]
  );

  const refresh = useCallback(async () => {
    setRefreshTick((t) => t + 1);
  }, []);

  const { containerRef, pullProgress, isRefreshing, pullDist } = usePullToRefresh(refresh);

  return (
    <PageShell maxWidth="xl" className="space-y-0 pb-8">
      <div ref={containerRef} className="relative space-y-4 min-h-[40vh]">
        {(pullDist > 8 || isRefreshing) && (
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex justify-center"
            style={{ transform: `translateY(${Math.min(pullDist, 56)}px)` }}
            aria-hidden
          >
            <div
              className={cn(
                "rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-soft",
                isRefreshing && "text-titan-cyan"
              )}
            >
              {isRefreshing ? "Refreshing…" : pullProgress >= 1 ? "Release" : "Pull to refresh"}
            </div>
          </div>
        )}

        <header className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
            Driver Hub
          </h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-10 w-10"
              onClick={refresh}
              disabled={isRefreshing}
              aria-label="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} aria-hidden />
            </Button>
          </div>
        </header>

        {!online ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100"
          >
            <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
            Offline — cached shift data still works. Sync resumes when you're back online.
          </div>
        ) : null}

        <MissionControl userId={user?.id} onOpenFolder={onOpenFolder} />

        {deliveryHits.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-2 shadow-soft">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Delivery search · {deliveryHits.length} hits
            </p>
            <ul className="divide-y divide-border max-h-48 overflow-y-auto">
              {deliveryHits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    className="w-full text-left py-2.5 min-h-[44px] hover:bg-muted/40 px-1 rounded-lg focus-ring"
                    onClick={() => onOpenFolder(hit.folder)}
                  >
                    <p className="text-sm font-medium text-foreground">{hit.title}</p>
                    <p className="text-xs text-muted-foreground">{hit.subtitle}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DriverExplorer
          user={user}
          openMap={openMap}
          search={search}
          onToggle={onToggle}
          onSearchChange={onSearchChange}
          summaries={summaries}
          forceOpenId={forceOpenId}
          directoryQuery={qParam}
          refreshTick={refreshTick}
        />
      </div>
    </PageShell>
  );
}
