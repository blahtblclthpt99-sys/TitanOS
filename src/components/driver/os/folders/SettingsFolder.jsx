import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { readPrefs, savePrefs } from "@/lib/driverHubApi";
import { toast } from "@/components/ui/use-toast";
import DriverLocationPanel from "@/components/driver/DriverLocationPanel";

export default function SettingsFolder({ user }) {
  const initial = useMemo(() => (user?.id ? readPrefs(user.id) : {}), [user?.id]);
  const [prefs, setPrefs] = useState(initial);

  if (!user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to edit Driver OS settings.</p>;
  }

  const patch = (partial) => {
    const next = savePrefs(user.id, { ...prefs, ...partial });
    setPrefs(next);
  };

  return (
    <div className="space-y-4">
      <DriverLocationPanel />
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ZIP / market</span>
        <input
          value={prefs.zip || ""}
          onChange={(e) => patch({ zip: e.target.value })}
          className="w-full h-11 rounded-xl border border-border bg-muted px-3 text-sm"
          placeholder="75001"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">MPG</span>
        <input
          type="number"
          min="1"
          step="0.1"
          value={prefs.mpg ?? 22}
          onChange={(e) => patch({ mpg: Number(e.target.value) || 22 })}
          className="w-full h-11 rounded-xl border border-border bg-muted px-3 text-sm"
        />
      </label>
      <label className="flex items-center justify-between gap-3 min-h-[48px] rounded-xl border border-border bg-muted/40 px-3">
        <span className="text-sm font-medium">Auto GPS track while Driving</span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-sky-500"
          checked={prefs.autoTrack !== false}
          onChange={(e) => patch({ autoTrack: e.target.checked })}
        />
      </label>
      <label className="flex items-center justify-between gap-3 min-h-[48px] rounded-xl border border-border bg-muted/40 px-3">
        <div className="min-w-0">
          <span className="text-sm font-medium block">Auto-start trip on motion</span>
          <span className="text-xs text-muted-foreground">Starts a shift when you keep moving (opt-in)</span>
        </div>
        <input
          type="checkbox"
          className="h-5 w-5 accent-sky-500 shrink-0"
          checked={Boolean(prefs.autoStartOnMotion)}
          onChange={(e) => patch({ autoStartOnMotion: e.target.checked })}
        />
      </label>
      <label className="flex items-center justify-between gap-3 min-h-[48px] rounded-xl border border-border bg-muted/40 px-3">
        <span className="text-sm font-medium">Location privacy acknowledged</span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-sky-500"
          checked={Boolean(prefs.locationPrivacyAck)}
          onChange={(e) => patch({ locationPrivacyAck: e.target.checked })}
        />
      </label>
      <Button
        type="button"
        className="min-h-[44px] w-full sm:w-auto"
        onClick={() =>
          toast({ title: "Settings saved", description: "Driver OS prefs are stored on this device." })
        }
      >
        Confirm settings
      </Button>
    </div>
  );
}
