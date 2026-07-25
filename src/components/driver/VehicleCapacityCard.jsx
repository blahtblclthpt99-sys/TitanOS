import React, { useMemo } from "react";
import { Package, Ruler, ShieldAlert, Truck } from "lucide-react";
import {
  CARGO_CONFIG_OPTIONS,
  estimateWhatFits,
  formatDimInches,
  formatWeightLb,
  hasCapacityData,
  normalizeVehicleCapacity,
  recommendJobTypes,
} from "@/lib/vehicleCapacity";

function Spec({ label, value }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground text-right">{value}</dd>
    </div>
  );
}

function Chip({ children, tone = "default" }) {
  const toneClass =
    tone === "ok"
      ? "border-success/30 bg-success/10"
      : tone === "warn"
        ? "border-warning/40 bg-warning/10"
        : "border-primary/30 bg-primary/10";
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-medium text-foreground ${toneClass}`}
    >
      {children}
    </span>
  );
}

/**
 * Read-only Vehicle Capacity card for public driver profiles.
 */
export default function VehicleCapacityCard({ driver, emptyHint }) {
  const cap = useMemo(
    () => normalizeVehicleCapacity(driver?.vehicleCapacity),
    [driver?.vehicleCapacity]
  );
  const unit = cap.unitSystem || "imperial";
  const ready = hasCapacityData(cap) || Boolean(driver?.vehicleType && driver?.vehicleMake);

  const fit = useMemo(() => estimateWhatFits(cap), [cap]);
  const jobs = useMemo(() => recommendJobTypes(cap), [cap]);

  const configLabel =
    CARGO_CONFIG_OPTIONS.find((o) => o.value === cap.identity.cargoConfiguration)?.label ||
    null;

  const titleParts = [
    cap.identity.year || driver?.vehicleYear,
    cap.identity.make || driver?.vehicleMake,
    cap.identity.model || driver?.vehicleModel,
    cap.identity.trim,
  ].filter(Boolean);

  if (!ready) {
    return (
      <section className="titan-surface space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Vehicle Capacity</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {emptyHint ||
            "This driver hasn’t added cargo dimensions or payload yet. Ask them before booking oversized loads."}
        </p>
      </section>
    );
  }

  return (
    <section className="titan-surface space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Vehicle Capacity</h2>
      </div>

      <div className="flex items-start gap-2">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-base font-semibold text-foreground">
            {titleParts.length
              ? titleParts.join(" ")
              : cap.identity.vehicleType || driver?.vehicleType || "Vehicle"}
          </p>
          <p className="text-xs text-muted-foreground">
            {[cap.identity.vehicleType || driver?.vehicleType, configLabel, cap.identity.driveType]
              .filter(Boolean)
              .join(" · ")}
            {cap.identity.seats != null ? ` · ${cap.identity.seats} seats` : ""}
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cargo dimensions
        </h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          <Spec label="Length" value={formatDimInches(cap.dimensions.cargoLengthIn, unit)} />
          <Spec label="Width" value={formatDimInches(cap.dimensions.cargoWidthIn, unit)} />
          <Spec label="Height" value={formatDimInches(cap.dimensions.cargoHeightIn, unit)} />
          <Spec
            label="Volume"
            value={
              cap.dimensions.cargoVolumeCuFt != null
                ? `${cap.dimensions.cargoVolumeCuFt} cu ft`
                : null
            }
          />
          <Spec
            label="Door opening"
            value={
              cap.dimensions.doorOpeningWidthIn != null ||
              cap.dimensions.doorOpeningHeightIn != null
                ? `${formatDimInches(cap.dimensions.doorOpeningWidthIn, unit)} × ${formatDimInches(cap.dimensions.doorOpeningHeightIn, unit)}`
                : null
            }
          />
          <Spec label="Bed length" value={formatDimInches(cap.dimensions.bedLengthIn, unit)} />
          <Spec
            label="Trailer length"
            value={formatDimInches(cap.dimensions.trailerLengthIn, unit)}
          />
        </dl>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Weight capacity
        </h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          <Spec
            label="Max payload"
            value={formatWeightLb(cap.weight.maxPayloadLb, unit)}
          />
          <Spec
            label="Working payload"
            value={formatWeightLb(cap.weight.recommendedWorkingPayloadLb, unit)}
          />
          <Spec
            label="Tongue weight"
            value={formatWeightLb(cap.weight.tongueWeightLb, unit)}
          />
          <Spec
            label="Max tow rating"
            value={formatWeightLb(cap.weight.maxTowRatingLb, unit)}
          />
          <Spec label="GVWR (info)" value={formatWeightLb(cap.weight.gvwrLb, unit)} />
        </dl>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What fits? · estimates
          </h3>
        </div>
        {!fit.ready ? (
          <p className="text-sm text-muted-foreground">{fit.message}</p>
        ) : fit.fits.length ? (
          <div className="flex flex-wrap gap-1.5">
            {fit.fits.slice(0, 10).map((item) => (
              <Chip key={item.id} tone="ok">
                {item.label}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No clear size matches from the estimate catalog.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Estimates only — measure the load and respect payload limits.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Suitable job types · estimates
        </h3>
        {!jobs.ready ? (
          <p className="text-sm text-muted-foreground">{jobs.message}</p>
        ) : jobs.suitable.length ? (
          <div className="flex flex-wrap gap-1.5">
            {jobs.suitable.map((job) => (
              <Chip key={job.id} tone={job.caution ? "warn" : "default"}>
                {job.label}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Capacity may be limited for typical job types listed here.
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>
          Never exceed the driver&apos;s stated payload or towing limits. Follow manufacturer
          recommendations and applicable laws.
        </p>
      </div>
    </section>
  );
}
