import React, { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, Gauge, Clock, Fuel, FileText } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { formatDuration, readShiftHistory, readSession, readStops, readPrefs } from "@/lib/driverHubApi";
import { findTrip, rateTripWorth, estimateFuelCost } from "@/lib/driverActivity/intelligence";
import { patchTripJournalEarnings, listTripJournal } from "@/lib/driverActivity/tripJournal";
import { readLocal, writeLocal } from "@/lib/localStore";
import { normalizeAppPath } from "@/lib/routing";

const PREFIX = "titanos_driver";

function patchTripEarnings(userId, tripId, earnings, tips, notes, zip) {
  const history = readLocal(PREFIX, userId, "history", []);
  const idx = history.findIndex((h) => h.id === tripId);
  if (idx < 0) return false;
  const z = String(zip || "").replace(/\D/g, "").slice(0, 5);
  history[idx] = {
    ...history[idx],
    earnings_gross: Number(earnings) || 0,
    tips: Number(tips) || 0,
    notes: notes || history[idx].notes || "",
    zip: z || history[idx].zip || "",
  };
  writeLocal(PREFIX, userId, "history", history);
  // Mirror payout onto journal rows for this session (ZIP averages)
  const journal = listTripJournal(userId).filter((r) => r.session_id === tripId);
  if (journal.length === 1) {
    patchTripJournalEarnings(userId, journal[0].id, {
      earnings: Number(earnings) || 0,
      tips: Number(tips) || 0,
      notes,
      zip: z,
    });
  } else if (journal.length > 1) {
    // Spread gross evenly across legs so ZIP buckets still get pay samples
    const share = (Number(earnings) || 0) / journal.length;
    const tipShare = (Number(tips) || 0) / journal.length;
    for (const row of journal) {
      patchTripJournalEarnings(userId, row.id, {
        earnings: Math.round(share * 100) / 100,
        tips: Math.round(tipShare * 100) / 100,
        zip: z || row.zip,
      });
    }
  }
  return true;
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-border last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground text-right">{value}</span>
    </div>
  );
}

export default function DriverTripDetail() {
  const location = useLocation();
  const tripId = useMemo(() => {
    const parts = normalizeAppPath(location.pathname).split("/").filter(Boolean);
    if (parts[0] === "driver" && parts[1] === "trip" && parts[2]) {
      return decodeURIComponent(parts.slice(2).join("/"));
    }
    return "";
  }, [location.pathname]);
  const { user, authChecked } = useAuth();
  const [tick, setTick] = useState(0);

  const prefs = user?.id ? readPrefs(user.id) : {};
  const mpg = Number(prefs.mpg) || 22;
  const gasUsd = 3.5;

  const trip = useMemo(() => {
    if (!user?.id || !tripId) return null;
    const history = readShiftHistory(user.id);
    const live = readSession(user.id);
    const stops = readStops(user.id);
    return findTrip(tripId, history, live?.active ? live : null, stops, { mpg, gasUsd });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tripId, tick, mpg, gasUsd]);

  const [earn, setEarn] = useState("");
  const [tips, setTips] = useState("");
  const [notes, setNotes] = useState("");
  const [zip, setZip] = useState("");

  useEffect(() => {
    if (!trip) return;
    setEarn(trip.earnings ? String(trip.earnings) : "");
    setTips(trip.tips ? String(trip.tips) : "");
    setNotes(trip.notes || "");
    setZip(trip.raw?.zip || prefs.zip || "");
  }, [trip?.id]);

  if (!authChecked) return <PageLoader label="Loading trip" />;
  if (!user?.id) {
    return (
      <PageShell>
        <EmptyState title="Sign in" description="Trip history is saved on your account device." />
      </PageShell>
    );
  }
  if (!trip) {
    return (
      <PageShell maxWidth="md">
        <PageHeader eyebrow="Driver Hub" title="Trip not found" />
        <EmptyState
          title="No trip with that id"
          description="It may have been cleared from local history."
          actionLabel="Back to Driver Hub"
          onAction={() => {
            window.location.href = "/driver?tab=intel";
          }}
        />
      </PageShell>
    );
  }

  const worth = rateTripWorth({
    earnings: trip.earnings || Number(earn) || 0,
    tips: trip.tips || Number(tips) || 0,
    miles: trip.miles,
    drive_sec: trip.drive_sec,
    mpg,
    gasUsd,
    userId: user?.id,
  });

  const mapUrl =
    trip.pickup?.lat != null && trip.dropoff?.lat != null
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${trip.pickup.lat}%2C${trip.pickup.lng}%3B${trip.dropoff.lat}%2C${trip.dropoff.lng}`
      : trip.pickup?.lat != null
        ? `https://www.openstreetmap.org/?mlat=${trip.pickup.lat}&mlon=${trip.pickup.lng}#map=14/${trip.pickup.lat}/${trip.pickup.lng}`
        : null;

  const savePayout = () => {
    if (trip.type === "leg") {
      toast({ title: "Log payouts on the parent work session trip" });
      return;
    }
    const ok = patchTripEarnings(user.id, trip.id, earn, tips, notes, zip);
    if (ok) {
      toast({ title: "Payout saved on this trip" });
      setTick((t) => t + 1);
    } else if (trip.active) {
      toast({
        variant: "destructive",
        title: "End the live session first",
        description: "Payouts attach to completed trip history.",
      });
    } else {
      toast({ variant: "destructive", title: "Couldn't save payout" });
    }
  };

  const fuelPerMile = estimateFuelCost(1, { mpg, gasUsd });

  return (
    <PageShell maxWidth="md">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 gap-1">
        <Link to="/driver?tab=intel">
          <ArrowLeft className="w-4 h-4" /> Intelligence
        </Link>
      </Button>
      <PageHeader
        eyebrow="Driver Hub · Trip"
        title={`Trip #${trip.trip_number ?? "—"}`}
        subtitle={`${trip.date || "—"} · ${trip.rush_label || "Unclassified"} · ${trip.platform}`}
      />

      <div className="grid sm:grid-cols-3 gap-2 mb-4">
        <div className="titan-surface p-3">
          <p className="text-[10px] uppercase text-muted-foreground flex gap-1 items-center">
            <Gauge className="w-3 h-3" /> Miles
          </p>
          <p className="text-2xl font-bold tabular-nums">{trip.miles}</p>
        </div>
        <div className="titan-surface p-3">
          <p className="text-[10px] uppercase text-muted-foreground flex gap-1 items-center">
            <Clock className="w-3 h-3" /> Drive
          </p>
          <p className="text-2xl font-bold tabular-nums">{formatDuration(trip.drive_sec)}</p>
        </div>
        <div className="titan-surface p-3">
          <p className="text-[10px] uppercase text-muted-foreground flex gap-1 items-center">
            <Fuel className="w-3 h-3" /> Profit est.
          </p>
          <p className="text-2xl font-bold tabular-nums">${trip.profit.toFixed(2)}</p>
        </div>
      </div>

      <section className="titan-surface p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2">Trip details</h2>
        <Row label="Start" value={trip.started_at ? new Date(trip.started_at).toLocaleString() : "—"} />
        <Row
          label="End"
          value={trip.ended_at ? new Date(trip.ended_at).toLocaleString() : trip.active ? "Live" : "—"}
        />
        <Row label="Duration" value={formatDuration(trip.duration_sec)} />
        <Row label="Idle" value={formatDuration(trip.idle_sec)} />
        <Row label="Avg speed" value={trip.avg_speed_mph ? `${trip.avg_speed_mph} mph` : "—"} />
        <Row label="Max speed" value={trip.max_speed_mph ? `${trip.max_speed_mph} mph` : "—"} />
        <Row label="Stops" value={trip.stop_count} />
        <Row label="Weekday" value={trip.weekday_name || "—"} />
        <Row label="$ / mi" value={trip.dollars_per_mile != null ? `$${trip.dollars_per_mile}` : "—"} />
        <Row label="$ / hr" value={trip.dollars_per_hour != null ? `$${trip.dollars_per_hour}` : "—"} />
        <Row label="Fuel est." value={`$${trip.fuel_cost.toFixed(2)}`} />
        <Row label="Wear est." value={`$${trip.wear_cost.toFixed(2)}`} />
        <Row label="Deductible est." value={`$${trip.deductible_est.toFixed(2)}`} />
      </section>

      <section className="titan-surface p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2">Worth-it score</h2>
        <p className="text-sm">
          {"★".repeat(worth.stars)}
          {"☆".repeat(5 - worth.stars)} · {worth.label}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{worth.reason}</p>
        {worth.recommended_min_gross_per_mile != null ? (
          <p className="text-[11px] tabular-nums text-muted-foreground mt-1">
            Need ≥ ${Number(worth.recommended_min_gross_per_mile).toFixed(2)}/mi · all-in $
            {Number(worth.true_cost_per_mile).toFixed(3)}/mi · offer $
            {Number(worth.estimated_per_mile).toFixed(2)}/mi
          </p>
        ) : null}
      </section>

      {mapUrl ? (
        <section className="titan-surface p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Route
          </h2>
          <Button asChild variant="outline" size="sm">
            <a href={mapUrl} target="_blank" rel="noreferrer">
              Open in OpenStreetMap
            </a>
          </Button>
        </section>
      ) : null}

      {trip.stops?.length > 0 ? (
        <section className="titan-surface p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2">Stops</h2>
          <ul className="space-y-2">
            {trip.stops.map((s, i) => (
              <li key={s.id || i} className="text-sm border-b border-border pb-2 last:border-0">
                <p className="font-medium">{s.label || `Stop ${i + 1}`}</p>
                <p className="text-xs text-muted-foreground">
                  {s.started_at ? new Date(s.started_at).toLocaleTimeString() : "—"}
                  {s.miles_since_prev != null || s.miles_delta != null
                    ? ` · ${s.miles_since_prev ?? s.miles_delta} mi leg`
                    : ""}
                  {s.app ? ` · ${s.app}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {trip.type === "session" && !trip.active ? (
        <section className="titan-surface p-4 mb-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" /> Log payout
          </h2>
          <p className="text-xs text-muted-foreground">
            Platforms aren&apos;t connected yet — enter earnings so Intelligence can score $/hr and
            $/mi. Fuel uses ~{mpg} MPG (~${fuelPerMile.toFixed(2)}/mi at ${gasUsd}/gal).
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Earnings</label>
              <Input
                value={earn}
                onChange={(e) => setEarn(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="bg-muted border-border"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Tips</label>
              <Input
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="bg-muted border-border"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">ZIP</label>
              <Input
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                maxLength={5}
                placeholder={prefs.zip || "75201"}
                className="bg-muted border-border"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-muted border-border" />
          </div>
          <Button type="button" onClick={savePayout}>
            Save payout
          </Button>
        </section>
      ) : null}
    </PageShell>
  );
}
