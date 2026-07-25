import React, { useEffect, useState } from "react";
import { Home, MapPinned } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import NativeSelect from "@/components/shared/NativeSelect";
import StatHint from "@/components/shared/StatHint";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { geocodePlace } from "@/lib/weatherApi";
import {
  DRIVER_LOCATION_HELP,
  emptyDriverLocation,
  formatDriverLocationLabel,
  normalizeDriverLocation,
  readDriverLocation,
  saveDriverLocation,
} from "@/lib/driverLocation";

const UNIT_OPTIONS = [
  { value: "mi", label: "Miles" },
  { value: "km", label: "Kilometers" },
];

const TZ_OPTIONS = [
  { value: "America/New_York", label: "Eastern (US)" },
  { value: "America/Chicago", label: "Central (US)" },
  { value: "America/Denver", label: "Mountain (US)" },
  { value: "America/Los_Angeles", label: "Pacific (US)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "UTC", label: "UTC" },
];

/**
 * Driver Location settings — personalization only (never drives sales tax).
 */
export default function DriverLocationPanel({ onSaved }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [form, setForm] = useState(() => emptyDriverLocation());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setForm(readDriverLocation(userId));
  }, [userId]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const useGps = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "GPS not available" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let patch = { lat, lng };
        try {
          const rev = await geocodePlace(`${lat},${lng}`);
          // reverse via open-meteo name search may not reverse; keep coords
          if (rev?.name) patch.homeCity = rev.name;
        } catch {
          /* optional */
        }
        setForm((f) => normalizeDriverLocation({ ...f, ...patch }));
        toast({ title: "Location updated from GPS" });
      },
      () => toast({ variant: "destructive", title: "Could not read GPS" }),
      { enableHighAccuracy: false, timeout: 12000 }
    );
  };

  const save = () => {
    if (!userId) {
      toast({ variant: "destructive", title: "Sign in required" });
      return;
    }
    setSaving(true);
    try {
      const saved = saveDriverLocation(userId, form);
      setForm(normalizeDriverLocation(saved));
      toast({
        title: "Driver Location saved",
        description: "Maps, weather, and nearby defaults updated. Sales tax is unchanged.",
      });
      onSaved?.(saved);
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <p className="text-sm text-muted-foreground">Sign in to set your Driver Location.</p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15">
          <Home className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-foreground">Driver Location</p>
            <StatHint label="Driver Location">
              <p>{DRIVER_LOCATION_HELP}</p>
            </StatHint>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Personalizes your map, weather, radius, and units. Does not control customer sales tax.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Current: {formatDriverLocationLabel(form)}
          </p>
        </div>
      </div>

      <Input
        placeholder="Home address"
        value={form.homeAddress || ""}
        onChange={(e) => set("homeAddress", e.target.value)}
        aria-label="Home address"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="City"
          value={form.homeCity || ""}
          onChange={(e) => set("homeCity", e.target.value)}
          aria-label="Home city"
        />
        <Input
          placeholder="State"
          value={form.homeState || ""}
          onChange={(e) => set("homeState", e.target.value)}
          aria-label="Home state"
        />
        <Input
          placeholder="ZIP / postal"
          value={form.homeZip || ""}
          onChange={(e) => set("homeZip", e.target.value)}
          aria-label="Home ZIP"
        />
        <Input
          placeholder="Preferred service area"
          value={form.preferredServiceArea || ""}
          onChange={(e) => set("preferredServiceArea", e.target.value)}
          aria-label="Preferred service area"
        />
        <Input
          type="number"
          min="0"
          max="2000"
          placeholder="Max service radius (mi)"
          value={form.maxServiceRadiusMi ?? ""}
          onChange={(e) =>
            set("maxServiceRadiusMi", e.target.value === "" ? 50 : Number(e.target.value))
          }
          aria-label="Maximum service radius in miles"
        />
        <NativeSelect
          value={form.distanceUnits || "mi"}
          onValueChange={(v) => set("distanceUnits", v)}
          options={UNIT_OPTIONS}
          aria-label="Distance units"
        />
        <NativeSelect
          value={
            TZ_OPTIONS.some((t) => t.value === form.timeZone)
              ? form.timeZone
              : "America/Chicago"
          }
          onValueChange={(v) => set("timeZone", v)}
          options={TZ_OPTIONS}
          aria-label="Time zone"
        />
        <Input
          placeholder="Currency (e.g. USD)"
          value={form.currency || "USD"}
          onChange={(e) => set("currency", e.target.value.toUpperCase())}
          aria-label="Currency"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={useGps} className="min-h-[44px]">
          <MapPinned className="h-4 w-4" aria-hidden="true" />
          Use GPS
        </Button>
        <Button type="button" disabled={saving} onClick={save} className="min-h-[44px]">
          {saving ? "Saving…" : "Save Driver Location"}
        </Button>
      </div>
    </div>
  );
}
