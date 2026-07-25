import React, { useEffect, useState } from "react";
import { Car, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NativeSelect from "@/components/shared/NativeSelect";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { resolveWeatherLocation } from "@/lib/weatherApi";
import { getMyDriverProfile, saveMyDriverProfile } from "@/lib/driverProfilesApi";
import { emptyVehicleCapacity, normalizeVehicleCapacity } from "@/lib/vehicleCapacity";

const VEHICLE_OPTIONS = [
  { value: "Box Truck", label: "Box Truck" },
  { value: "Cargo Van", label: "Cargo Van" },
  { value: "Pickup", label: "Pickup" },
  { value: "Flatbed", label: "Flatbed" },
  { value: "Semi / Tractor", label: "Semi / Tractor" },
];

const LICENSE_OPTIONS = [
  { value: "Non-CDL", label: "Non-CDL" },
  { value: "CDL Class B", label: "CDL Class B" },
  { value: "CDL Class A", label: "CDL Class A" },
];

const AVAIL_OPTIONS = [
  { value: "available", label: "Available now" },
  { value: "busy", label: "On a job" },
  { value: "offline", label: "Offline (hidden)" },
];

export default function DriverPublishPanel({ onSaved }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    city: "",
    vehicleType: "Cargo Van",
    licenseClass: "Non-CDL",
    rateHourly: "",
    bio: "",
    availability: "available",
    insured: false,
    yearsExperience: "",
  });
  const [mineCapacity, setMineCapacity] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const mine = await getMyDriverProfile(userId);
      if (!alive) return;
      if (mine) {
        setMineCapacity(
          mine.vehicleCapacity
            ? normalizeVehicleCapacity(mine.vehicleCapacity)
            : emptyVehicleCapacity()
        );
        setForm({
          name: mine.name || user?.full_name || "",
          city: mine.city || [user?.city, user?.state].filter(Boolean).join(", "),
          vehicleType: mine.vehicleType || "Cargo Van",
          licenseClass: mine.licenseClass || "Non-CDL",
          rateHourly: mine.rateHourly ? String(mine.rateHourly) : "",
          bio: mine.bio || "",
          availability: mine.availability || "offline",
          insured: Boolean(mine.insured),
          yearsExperience: mine.yearsExperience ? String(mine.yearsExperience) : "",
        });
      } else {
        setMineCapacity(emptyVehicleCapacity());
        setForm((f) => ({
          ...f,
          name: user?.full_name || "",
          city: [user?.city, user?.state].filter(Boolean).join(", "),
        }));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId, user?.full_name, user?.city, user?.state]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const publish = async ({ published }) => {
    if (!userId) {
      toast({ variant: "destructive", title: "Sign in required" });
      return;
    }
    setSaving(true);
    try {
      const loc = await resolveWeatherLocation(user);
      const vehicleTags = [];
      const vt = form.vehicleType.toLowerCase();
      if (vt.includes("box")) vehicleTags.push("box_truck");
      if (vt.includes("van")) vehicleTags.push("cargo_van");
      if (vt.includes("pickup")) vehicleTags.push("pickup");
      if (vt.includes("flat")) vehicleTags.push("flatbed");
      if (form.licenseClass.includes("Class A")) vehicleTags.push("cdl_class_a", "cdl");
      else if (form.licenseClass.includes("Class B")) vehicleTags.push("cdl_class_b", "cdl");
      else vehicleTags.push("non_cdl");

      await saveMyDriverProfile(userId, {
        name: form.name || user?.full_name || "Driver",
        city: form.city,
        vehicleType: form.vehicleType,
        licenseClass: form.licenseClass,
        rateHourly: Number(form.rateHourly) || 0,
        bio: form.bio,
        availability: published ? form.availability || "available" : "offline",
        insured: form.insured,
        yearsExperience: Number(form.yearsExperience) || 0,
        vehicleTags,
        routes: ["local"],
        published,
        lat: loc.lat,
        lng: loc.lon,
        photo: user?.avatar_url || "",
        vehicleCapacity: {
          ...(mineCapacity || {}),
          identity: {
            ...(mineCapacity?.identity || {}),
            vehicleType: form.vehicleType,
          },
        },
      });
      toast({
        title: published ? "You're listed" : "Profile saved offline",
        description: published
          ? "Other TitanOS users can find you in Find drivers."
          : "Unpublished — you won't appear in the directory.",
      });
      onSaved?.();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save profile",
        description: err?.message || "Try again after migration 022 is applied.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Sign in to publish your driver profile and appear in Find drivers.
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading your driver profile…</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15">
          <Car className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Your driver listing</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Publish yourself to the live directory. No sample profiles — only real accounts.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Display name"
          aria-label="Display name"
        />
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="City, ST"
            className="pl-9"
            aria-label="City"
          />
        </div>
        <NativeSelect
          value={form.vehicleType}
          onValueChange={(v) => set("vehicleType", v)}
          options={VEHICLE_OPTIONS}
          aria-label="Vehicle type"
        />
        <NativeSelect
          value={form.licenseClass}
          onValueChange={(v) => set("licenseClass", v)}
          options={LICENSE_OPTIONS}
          aria-label="License"
        />
        <Input
          type="number"
          min="0"
          value={form.rateHourly}
          onChange={(e) => set("rateHourly", e.target.value)}
          placeholder="Rate $/hr"
          aria-label="Hourly rate"
        />
        <Input
          type="number"
          min="0"
          value={form.yearsExperience}
          onChange={(e) => set("yearsExperience", e.target.value)}
          placeholder="Years experience"
          aria-label="Years experience"
        />
        <NativeSelect
          value={form.availability}
          onValueChange={(v) => set("availability", v)}
          options={AVAIL_OPTIONS}
          aria-label="Availability"
          className="sm:col-span-2"
        />
        <Input
          value={form.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="Short bio"
          aria-label="Bio"
          className="sm:col-span-2"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={form.insured}
          onChange={(e) => set("insured", e.target.checked)}
          className="rounded border-border"
        />
        I carry commercial insurance (self-reported)
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => publish({ published: true })}>
          {saving ? "Saving…" : "Go available / publish"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => publish({ published: false })}
        >
          Unpublish
        </Button>
      </div>
    </div>
  );
}
