import React from "react";
import DoorDashWorkflowPanel from "@/components/driver/activity/DoorDashWorkflowPanel";
import { PLATFORMS } from "@/lib/driverOs/folders.js";

export default function PlatformsFolder() {
  return (
    <div className="space-y-2">
      {PLATFORMS.map((p) => (
        <details key={p.id} className="rounded-xl border border-border overflow-hidden" open={p.id === "doordash"}>
          <summary className="px-3 py-2.5 bg-muted/40 text-sm font-semibold cursor-pointer min-h-[44px] flex items-center justify-between">
            <span>{p.label}</span>
            {p.id === "doordash" ? (
              <span className="text-[10px] uppercase tracking-wide text-sky-400">Live</span>
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ready</span>
            )}
          </summary>
          <div className="p-3">
            {p.id === "doordash" ? (
              <DoorDashWorkflowPanel />
            ) : (
              <p className="text-sm text-muted-foreground">
                Independent analytics for {p.label} will appear here as you log trips. Architecture is modular —
                no redesign needed when you add this platform.
              </p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
