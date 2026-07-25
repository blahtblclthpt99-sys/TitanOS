import React, { useEffect, useMemo, useState } from "react";
import { Ruler, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NativeSelect from "@/components/shared/NativeSelect";
import StatHint from "@/components/shared/StatHint";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getMyDriverProfile, saveMyDriverProfile } from "@/lib/driverProfilesApi";
import {
  CARGO_CONFIG_OPTIONS,
  DRIVE_TYPE_OPTIONS,
  FIELD_HELP,
  UNIT_SYSTEMS,
  capacityToLegacyVehicleFields,
  computeVolumeCuFt,
  displayFromInches,
  displayFromLb,
  emptyVehicleCapacity,
  estimateWhatFits,
  inchesFromDisplay,
  lbFromDisplay,
  normalizeVehicleCapacity,
  recommendJobTypes,
  validateVehicleCapacity,
} from "@/lib/vehicleCapacity";

const VEHICLE_TYPE_OPTIONS = [
  { value: "Cargo Van", label: "Cargo Van" },
  { value: "Box Truck", label: "Box Truck" },
  { value: "Pickup", label: "Pickup" },
  { value: "Flatbed", label: "Flatbed" },
  { value: "Semi / Tractor", label: "Semi / Tractor" },
  { value: "SUV", label: "SUV" },
  { value: "Other", label: "Other" },
];

function LabelWithHint({ htmlFor, label, hint }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {hint ? (
        <StatHint label={label}>
          <p>{hint}</p>
        </StatHint>
      ) : null}
    </div>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <div>
      <LabelWithHint htmlFor={id} label={label} hint={hint} />
      {children}
    </div>
  );
}

/** Visual cue for cargo box proportions (relative, not to scale). */
function CargoSpaceVisual({ lengthIn, widthIn, heightIn }) {
  const L = Number(lengthIn) || 0;
  const W = Number(widthIn) || 0;
  const H = Number(heightIn) || 0;
  if (L <= 0 || W <= 0 || H <= 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
        Enter length, width, and height to preview cargo space proportions.
      </div>
    );
  }
  const max = Math.max(L, W, H);
  const wPct = Math.max(28, Math.round((W / max) * 100));
  const hPct = Math.max(22, Math.round((H / max) * 70));
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-4">
      <p className="mb-3 text-center text-[11px] font-medium text-muted-foreground">
        Cargo space (relative sizes — not to scale)
      </p>
      <div className="flex items-end justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <div
            className="rounded-sm border-2 border-primary/60 bg-primary/15 shadow-md"
            style={{ width: `${wPct}px`, height: `${hPct}px` }}
            aria-hidden="true"
          />
          <span className="text-[10px] text-muted-foreground">L×W×H</span>
        </div>
      </div>
    </div>
  );
}

function capacityFromDriver(driver) {
  if (driver?.vehicleCapacity && typeof driver.vehicleCapacity === "object") {
    return normalizeVehicleCapacity(driver.vehicleCapacity);
  }
  return emptyVehicleCapacity({
    identity: {
      vehicleType: driver?.vehicleType || "Cargo Van",
      year: driver?.vehicleYear ?? null,
      make: driver?.vehicleMake || "",
      model: driver?.vehicleModel || "",
    },
    weight: {
      maxPayloadLb: driver?.vehicleCapacityLbs ?? null,
    },
    dimensions: {
      cargoLengthIn:
        driver?.vehicleLengthFt != null ? Number(driver.vehicleLengthFt) * 12 : null,
    },
  });
}

export default function VehicleCapacityEditor({ onSaved }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cap, setCap] = useState(() => emptyVehicleCapacity());
  const [display, setDisplay] = useState({});

  const unit = cap.unitSystem || "imperial";
  const dimKind = "length"; // form stores short dims in inches or cm
  const longKind = unit === "imperial" ? "feet" : "length"; // long cargo in feet or cm

  const syncDisplay = (nextCap) => {
    const c = normalizeVehicleCapacity(nextCap);
    const u = c.unitSystem || "imperial";
    const long = u === "imperial" ? "feet" : "length";
    setDisplay({
      cargoLength: displayFromInches(c.dimensions.cargoLengthIn, u, long),
      cargoWidth: displayFromInches(c.dimensions.cargoWidthIn, u, "length"),
      cargoHeight: displayFromInches(c.dimensions.cargoHeightIn, u, "length"),
      cargoVolume: c.dimensions.cargoVolumeCuFt != null ? String(c.dimensions.cargoVolumeCuFt) : "",
      doorWidth: displayFromInches(c.dimensions.doorOpeningWidthIn, u, "length"),
      doorHeight: displayFromInches(c.dimensions.doorOpeningHeightIn, u, "length"),
      bedLength: displayFromInches(c.dimensions.bedLengthIn, u, long),
      trailerLength: displayFromInches(c.dimensions.trailerLengthIn, u, long),
      maxPayload: displayFromLb(c.weight.maxPayloadLb, u),
      recommendedPayload: displayFromLb(c.weight.recommendedWorkingPayloadLb, u),
      tongueWeight: displayFromLb(c.weight.tongueWeightLb, u),
      towRating: displayFromLb(c.weight.maxTowRatingLb, u),
      gvwr: displayFromLb(c.weight.gvwrLb, u),
    });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const mine = await getMyDriverProfile(userId);
      if (!alive) return;
      const next = capacityFromDriver(mine);
      setCap(next);
      syncDisplay(next);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const setIdentity = (key, value) => {
    setCap((c) => ({ ...c, identity: { ...c.identity, [key]: value } }));
  };

  const applyDimFromDisplay = (key, displayKey, kind) => {
    const inches = inchesFromDisplay(display[displayKey], unit, kind);
    setCap((c) => {
      const dimensions = { ...c.dimensions, [key]: inches };
      if (
        key === "cargoLengthIn" ||
        key === "cargoWidthIn" ||
        key === "cargoHeightIn"
      ) {
        const auto = computeVolumeCuFt(dimensions);
        if (auto != null && !display.cargoVolume) {
          dimensions.cargoVolumeCuFt = auto;
        }
      }
      return { ...c, dimensions };
    });
  };

  const applyWeightFromDisplay = (key, displayKey) => {
    const lb = lbFromDisplay(display[displayKey], unit);
    setCap((c) => ({ ...c, weight: { ...c.weight, [key]: lb } }));
  };

  const setUnitSystem = (nextUnit) => {
    const next = normalizeVehicleCapacity({ ...cap, unitSystem: nextUnit });
    setCap(next);
    syncDisplay(next);
  };

  const fit = useMemo(() => estimateWhatFits(cap), [cap]);
  const jobs = useMemo(() => recommendJobTypes(cap), [cap]);

  const weightSuffix = unit === "metric" ? "kg" : "lb";
  const lengthSuffix = unit === "metric" ? "cm" : "in";
  const longSuffix = unit === "metric" ? "cm" : "ft";

  const save = async () => {
    if (!userId) {
      toast({ variant: "destructive", title: "Sign in required" });
      return;
    }
    const built = {
      ...cap,
      dimensions: {
        ...cap.dimensions,
        cargoLengthIn: inchesFromDisplay(display.cargoLength, unit, longKind),
        cargoWidthIn: inchesFromDisplay(display.cargoWidth, unit, dimKind),
        cargoHeightIn: inchesFromDisplay(display.cargoHeight, unit, dimKind),
        cargoVolumeCuFt:
          display.cargoVolume === "" || display.cargoVolume == null
            ? computeVolumeCuFt({
                cargoLengthIn: inchesFromDisplay(display.cargoLength, unit, longKind),
                cargoWidthIn: inchesFromDisplay(display.cargoWidth, unit, dimKind),
                cargoHeightIn: inchesFromDisplay(display.cargoHeight, unit, dimKind),
              })
            : Number(display.cargoVolume),
        doorOpeningWidthIn: inchesFromDisplay(display.doorWidth, unit, dimKind),
        doorOpeningHeightIn: inchesFromDisplay(display.doorHeight, unit, dimKind),
        bedLengthIn: inchesFromDisplay(display.bedLength, unit, longKind),
        trailerLengthIn: inchesFromDisplay(display.trailerLength, unit, longKind),
      },
      weight: {
        ...cap.weight,
        maxPayloadLb: lbFromDisplay(display.maxPayload, unit),
        recommendedWorkingPayloadLb: lbFromDisplay(display.recommendedPayload, unit),
        tongueWeightLb: lbFromDisplay(display.tongueWeight, unit),
        maxTowRatingLb: lbFromDisplay(display.towRating, unit),
        gvwrLb: lbFromDisplay(display.gvwr, unit),
      },
    };

    const { ok, errors, value } = validateVehicleCapacity(built);
    if (!ok) {
      toast({
        variant: "destructive",
        title: "Check your numbers",
        description: errors[0] || "Invalid capacity values.",
      });
      return;
    }

    setSaving(true);
    try {
      const legacy = capacityToLegacyVehicleFields(value);
      await saveMyDriverProfile(userId, {
        vehicleCapacity: value,
        ...legacy,
      });
      setCap(value);
      syncDisplay(value);
      toast({
        title: "Vehicle capacity saved",
        description: "Customers can see what your vehicle can carry.",
      });
      onSaved?.();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description:
          err?.message?.includes("vehicle_capacity") || err?.code === "PGRST204"
            ? "Run migration 024 in Supabase, then try again."
            : err?.message || "Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Sign in to add vehicle capacity details to your driver profile.
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading vehicle capacity…</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15">
          <Ruler className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Vehicle Capacity</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enter what your vehicle can safely carry. We never invent manufacturer specs — only
            your numbers.
          </p>
        </div>
      </div>

      <NativeSelect
        value={unit}
        onValueChange={setUnitSystem}
        options={UNIT_SYSTEMS.map((u) => ({ value: u.id, label: u.label }))}
        aria-label="Unit system"
      />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vehicle profile
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field id="vc-type" label="Vehicle type">
            <NativeSelect
              id="vc-type"
              value={cap.identity.vehicleType || "Cargo Van"}
              onValueChange={(v) => setIdentity("vehicleType", v)}
              options={VEHICLE_TYPE_OPTIONS}
              aria-label="Vehicle type"
            />
          </Field>
          <Field id="vc-year" label="Year">
            <Input
              id="vc-year"
              type="number"
              inputMode="numeric"
              min="1950"
              max={new Date().getFullYear() + 1}
              value={cap.identity.year ?? ""}
              onChange={(e) =>
                setIdentity("year", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="e.g. 2019"
            />
          </Field>
          <Field id="vc-make" label="Make">
            <Input
              id="vc-make"
              value={cap.identity.make || ""}
              onChange={(e) => setIdentity("make", e.target.value)}
              placeholder="e.g. Ford"
            />
          </Field>
          <Field id="vc-model" label="Model">
            <Input
              id="vc-model"
              value={cap.identity.model || ""}
              onChange={(e) => setIdentity("model", e.target.value)}
              placeholder="e.g. Transit"
            />
          </Field>
          <Field id="vc-trim" label="Trim (optional)">
            <Input
              id="vc-trim"
              value={cap.identity.trim || ""}
              onChange={(e) => setIdentity("trim", e.target.value)}
              placeholder="e.g. 250"
            />
          </Field>
          <Field id="vc-config" label="Cargo configuration" hint={FIELD_HELP.cargoConfig}>
            <NativeSelect
              id="vc-config"
              value={cap.identity.cargoConfiguration || ""}
              onValueChange={(v) => setIdentity("cargoConfiguration", v)}
              options={CARGO_CONFIG_OPTIONS}
              aria-label="Cargo configuration"
            />
          </Field>
          <Field id="vc-seats" label="Number of seats" hint={FIELD_HELP.seats}>
            <Input
              id="vc-seats"
              type="number"
              min="1"
              max="60"
              value={cap.identity.seats ?? ""}
              onChange={(e) =>
                setIdentity("seats", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="e.g. 2"
            />
          </Field>
          <Field id="vc-drive" label="Drive type (optional)" hint={FIELD_HELP.driveType}>
            <NativeSelect
              id="vc-drive"
              value={cap.identity.driveType || ""}
              onValueChange={(v) => setIdentity("driveType", v)}
              options={DRIVE_TYPE_OPTIONS}
              aria-label="Drive type"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cargo dimensions
        </h3>
        <CargoSpaceVisual
          lengthIn={cap.dimensions.cargoLengthIn}
          widthIn={cap.dimensions.cargoWidthIn}
          heightIn={cap.dimensions.cargoHeightIn}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Field
            id="vc-len"
            label={`Cargo length (${longSuffix})`}
            hint={FIELD_HELP.cargoLength}
          >
            <Input
              id="vc-len"
              type="number"
              min="0"
              step="0.1"
              value={display.cargoLength ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, cargoLength: e.target.value }))}
              onBlur={() => applyDimFromDisplay("cargoLengthIn", "cargoLength", longKind)}
            />
          </Field>
          <Field
            id="vc-wid"
            label={`Cargo width (${lengthSuffix})`}
            hint={FIELD_HELP.cargoWidth}
          >
            <Input
              id="vc-wid"
              type="number"
              min="0"
              step="0.1"
              value={display.cargoWidth ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, cargoWidth: e.target.value }))}
              onBlur={() => applyDimFromDisplay("cargoWidthIn", "cargoWidth", dimKind)}
            />
          </Field>
          <Field
            id="vc-hei"
            label={`Cargo height (${lengthSuffix})`}
            hint={FIELD_HELP.cargoHeight}
          >
            <Input
              id="vc-hei"
              type="number"
              min="0"
              step="0.1"
              value={display.cargoHeight ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, cargoHeight: e.target.value }))}
              onBlur={() => applyDimFromDisplay("cargoHeightIn", "cargoHeight", dimKind)}
            />
          </Field>
          <Field id="vc-vol" label="Cargo volume (cu ft)" hint={FIELD_HELP.cargoVolume}>
            <Input
              id="vc-vol"
              type="number"
              min="0"
              step="0.1"
              value={display.cargoVolume ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, cargoVolume: e.target.value }))}
              placeholder="Auto from L×W×H"
            />
          </Field>
          <Field
            id="vc-door-w"
            label={`Door opening width (${lengthSuffix})`}
            hint={FIELD_HELP.doorWidth}
          >
            <Input
              id="vc-door-w"
              type="number"
              min="0"
              step="0.1"
              value={display.doorWidth ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, doorWidth: e.target.value }))}
              onBlur={() => applyDimFromDisplay("doorOpeningWidthIn", "doorWidth", dimKind)}
            />
          </Field>
          <Field
            id="vc-door-h"
            label={`Door opening height (${lengthSuffix})`}
            hint={FIELD_HELP.doorHeight}
          >
            <Input
              id="vc-door-h"
              type="number"
              min="0"
              step="0.1"
              value={display.doorHeight ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, doorHeight: e.target.value }))}
              onBlur={() => applyDimFromDisplay("doorOpeningHeightIn", "doorHeight", dimKind)}
            />
          </Field>
          <Field
            id="vc-bed"
            label={`Bed length (${longSuffix})`}
            hint={FIELD_HELP.bedLength}
          >
            <Input
              id="vc-bed"
              type="number"
              min="0"
              step="0.1"
              value={display.bedLength ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, bedLength: e.target.value }))}
              onBlur={() => applyDimFromDisplay("bedLengthIn", "bedLength", longKind)}
            />
          </Field>
          <Field
            id="vc-trailer"
            label={`Trailer length (${longSuffix})`}
            hint={FIELD_HELP.trailerLength}
          >
            <Input
              id="vc-trailer"
              type="number"
              min="0"
              step="0.1"
              value={display.trailerLength ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, trailerLength: e.target.value }))}
              onBlur={() => applyDimFromDisplay("trailerLengthIn", "trailerLength", longKind)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Weight capacity
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field
            id="vc-max-pay"
            label={`Maximum payload (${weightSuffix})`}
            hint={FIELD_HELP.maxPayload}
          >
            <Input
              id="vc-max-pay"
              type="number"
              min="0"
              step="1"
              value={display.maxPayload ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, maxPayload: e.target.value }))}
              onBlur={() => applyWeightFromDisplay("maxPayloadLb", "maxPayload")}
            />
          </Field>
          <Field
            id="vc-rec-pay"
            label={`Recommended working payload (${weightSuffix})`}
            hint={FIELD_HELP.recommendedPayload}
          >
            <Input
              id="vc-rec-pay"
              type="number"
              min="0"
              step="1"
              value={display.recommendedPayload ?? ""}
              onChange={(e) =>
                setDisplay((d) => ({ ...d, recommendedPayload: e.target.value }))
              }
              onBlur={() =>
                applyWeightFromDisplay("recommendedWorkingPayloadLb", "recommendedPayload")
              }
            />
          </Field>
          <Field
            id="vc-tongue"
            label={`Tongue weight (${weightSuffix})`}
            hint={FIELD_HELP.tongueWeight}
          >
            <Input
              id="vc-tongue"
              type="number"
              min="0"
              step="1"
              value={display.tongueWeight ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, tongueWeight: e.target.value }))}
              onBlur={() => applyWeightFromDisplay("tongueWeightLb", "tongueWeight")}
            />
          </Field>
          <Field
            id="vc-tow"
            label={`Maximum tow rating (${weightSuffix})`}
            hint={FIELD_HELP.towRating}
          >
            <Input
              id="vc-tow"
              type="number"
              min="0"
              step="1"
              value={display.towRating ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, towRating: e.target.value }))}
              onBlur={() => applyWeightFromDisplay("maxTowRatingLb", "towRating")}
            />
          </Field>
          <Field id="vc-gvwr" label={`GVWR (${weightSuffix})`} hint={FIELD_HELP.gvwr}>
            <Input
              id="vc-gvwr"
              type="number"
              min="0"
              step="1"
              value={display.gvwr ?? ""}
              onChange={(e) => setDisplay((d) => ({ ...d, gvwr: e.target.value }))}
              onBlur={() => applyWeightFromDisplay("gvwrLb", "gvwr")}
              className="sm:col-span-2"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What fits? · estimates only
        </h3>
        {!fit.ready ? (
          <p className="text-sm text-muted-foreground">{fit.message}</p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">{fit.message}</p>
            {fit.fits.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {fit.fits.slice(0, 12).map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-medium text-foreground"
                    title={item.note}
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No catalog items clearly fit these dimensions yet.
              </p>
            )}
            {fit.mayFit.length ? (
              <p className="text-[11px] text-warning">
                Size OK but over payload (estimate):{" "}
                {fit.mayFit
                  .slice(0, 4)
                  .map((i) => i.label)
                  .join(", ")}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Job matching · within your limits
        </h3>
        {!jobs.ready ? (
          <p className="text-sm text-muted-foreground">{jobs.message}</p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">{jobs.message}</p>
            {jobs.suitable.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {jobs.suitable.map((job) => (
                  <li
                    key={job.id}
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                      job.caution
                        ? "border-warning/40 bg-warning/10 text-foreground"
                        : "border-primary/30 bg-primary/10 text-foreground"
                    }`}
                    title={job.note}
                  >
                    {job.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add more capacity details to unlock job suggestions.
              </p>
            )}
          </>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p>
          Never load beyond your entered payload or towing limits. Follow the vehicle
          manufacturer&apos;s recommendations and applicable laws. Fit and job suggestions are
          estimates only.
        </p>
      </div>

      <Button type="button" disabled={saving} onClick={save} className="min-h-[44px] w-full sm:w-auto">
        <Save className="h-4 w-4" aria-hidden="true" />
        {saving ? "Saving…" : "Save vehicle capacity"}
      </Button>
    </div>
  );
}
