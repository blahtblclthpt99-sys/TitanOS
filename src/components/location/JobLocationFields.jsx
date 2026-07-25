import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StatHint from "@/components/shared/StatHint";
import {
  computeTravelSummary,
  emptyJobLocation,
  formatJobLocation,
  normalizeJobLocation,
  resolveJobLocation,
} from "@/lib/jobLocation";
import { calculateDocumentTax } from "@/lib/taxEngine";
import { readDriverLocation } from "@/lib/driverLocation";
import { useAuth } from "@/lib/AuthContext";

export const JOB_LOCATION_HELP =
  "Job Location is where the work or delivery happens. Sales tax, travel, and service checks use this address — not your Driver Location.";

/**
 * Job Location editor for estimates / invoices / jobs.
 * Resolves tax from Tax Engine; shows travel vs Driver Location.
 */
export default function JobLocationFields({
  value,
  onChange,
  lineItems = [],
  taxExempt = false,
  onTaxChange,
  showTravel = true,
  showTax = true,
}) {
  const { user } = useAuth();
  const [loc, setLoc] = useState(() => normalizeJobLocation(value || emptyJobLocation()));
  const [resolving, setResolving] = useState(false);
  const [warning, setWarning] = useState("");

  useEffect(() => {
    setLoc(normalizeJobLocation(value || emptyJobLocation()));
  }, [value]);

  const setField = (key, v) => {
    const next = normalizeJobLocation({ ...loc, [key]: v, validated: false });
    setLoc(next);
    onChange?.(next);
  };

  const taxResult = useMemo(() => {
    if (!showTax) return null;
    return calculateDocumentTax({
      lineItems,
      jobLocation: loc,
      taxExempt,
      recalculate: true,
    });
  }, [lineItems, loc, taxExempt, showTax]);

  const onTaxChangeRef = React.useRef(onTaxChange);
  onTaxChangeRef.current = onTaxChange;
  useEffect(() => {
    if (showTax && taxResult) onTaxChangeRef.current?.(taxResult);
  }, [taxResult, showTax]);

  const travel = useMemo(() => {
    if (!showTravel || !user?.id) return null;
    const driver = readDriverLocation(user.id);
    return computeTravelSummary(driver, loc, { distanceUnits: driver.distanceUnits });
  }, [loc, showTravel, user?.id]);

  const refreshLocation = async () => {
    setResolving(true);
    setWarning("");
    try {
      const result = await resolveJobLocation(loc);
      if (!result.ok) {
        setWarning(result.errors?.[0] || "Could not validate Job Location.");
        return;
      }
      if (result.warning) setWarning(result.warning);
      setLoc(result.location);
      onChange?.(result.location);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-foreground">Job Location</p>
            <StatHint label="Job Location">
              <p>{JOB_LOCATION_HELP}</p>
            </StatHint>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Determines sales tax and travel — separate from your Driver Location.
          </p>
        </div>
      </div>

      <Input
        placeholder="Street address"
        value={loc.address || ""}
        onChange={(e) => setField("address", e.target.value)}
        aria-label="Job street address"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="City"
          value={loc.city || ""}
          onChange={(e) => setField("city", e.target.value)}
          aria-label="Job city"
        />
        <Input
          placeholder="State"
          value={loc.state || ""}
          onChange={(e) => setField("state", e.target.value)}
          aria-label="Job state"
        />
        <Input
          placeholder="County (optional)"
          value={loc.county || ""}
          onChange={(e) => setField("county", e.target.value)}
          aria-label="Job county"
        />
        <Input
          placeholder="ZIP / postal"
          value={loc.zip || ""}
          onChange={(e) => setField("zip", e.target.value)}
          aria-label="Job ZIP"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[40px]"
        disabled={resolving}
        onClick={refreshLocation}
      >
        {resolving ? "Updating…" : "Validate & pin on map"}
      </Button>

      {loc.formatted || formatJobLocation(loc) ? (
        <p className="text-xs text-muted-foreground">
          {loc.formatted || formatJobLocation(loc)}
          {loc.lat != null && loc.lng != null
            ? ` · ${Number(loc.lat).toFixed(4)}, ${Number(loc.lng).toFixed(4)}`
            : ""}
        </p>
      ) : null}
      {warning ? <p className="text-xs text-warning">{warning}</p> : null}

      {showTax && taxResult ? (
        <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs space-y-1">
          {taxResult.ok ? (
            <>
              <p className="font-medium text-foreground">
                Tax: {taxResult.taxRate}% · {taxResult.jurisdiction?.rule?.label || "Matched rule"}
              </p>
              <p className="text-muted-foreground">{taxResult.jurisdiction?.message}</p>
            </>
          ) : (
            <p className="text-muted-foreground">{taxResult.error || taxResult.jurisdiction?.message}</p>
          )}
        </div>
      ) : null}

      {showTravel && travel ? (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>{travel.message}</p>
        </div>
      ) : null}
    </div>
  );
}
