import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Car,
  Fuel,
  MapPin,
  Navigation,
  Pause,
  Phone,
  Plus,
  Siren,
  Timer,
  ToggleLeft,
  ToggleRight,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HotspotMap from "@/components/driver/HotspotMap";
import StatHint from "@/components/shared/StatHint";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import { toast } from "@/components/ui/use-toast";
import {
  addStop,
  buildHotspots,
  calcFuelCost,
  coachTip,
  computeShiftDashboard,
  convertFromUsd,
  currencySymbol,
  dayPartLabel,
  endStop,
  estimateGasPriceUsd,
  estimateMpg,
  formatDuration,
  getDayPart,
  listDriverVehicles,
  parseMilesInput,
  readPrefs,
  readSession,
  readShiftHistory,
  readStops,
  savePrefs,
  startDrivingSession,
  stopDrivingSession,
  syncSessionToTax,
  topHotspotsNow,
  updateSessionMiles,
  IRS_MILEAGE_RATE_USD,
  summarizeRecordedShifts,
} from "@/lib/driverHubApi";
import { vehicleLabel } from "@/lib/vehicleCatalog";

const CURRENCIES = ["USD", "CAD", "MXN", "EUR", "GBP", "AUD", "JPY", "BRL"];

export default function DriverShiftPanel() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(() => readPrefs(user?.id));
  const [session, setSession] = useState(() => readSession(user?.id));
  const [stops, setStops] = useState(() => readStops(user?.id));
  const [history, setHistory] = useState(() => (user?.id ? readShiftHistory(user.id) : []));
  const [vehicles, setVehicles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [milesDraft, setMilesDraft] = useState("");
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [previewPart, setPreviewPart] = useState(null);
  const [focusId, setFocusId] = useState(null);

  const [milesError, setMilesError] = useState("");
  const [toggleError, setToggleError] = useState("");

  const mode = prefs.mode === "riding" ? "riding" : "driving";
  const requestingRide = Boolean(prefs.requestingRide);
  const drivingActive = Boolean(session?.active);

  const refresh = useCallback(() => {
    if (!user?.id) return;
    setPrefs(readPrefs(user.id));
    setSession(readSession(user.id));
    setStops(readStops(user.id));
    setHistory(readShiftHistory(user.id));
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    listDriverVehicles(user.id).then(setVehicles).catch(() => setVehicles([]));
  }, [user?.id]);

  useEffect(() => {
    if (!session?.active) return undefined;
    setMilesDraft(String(session.miles ?? 0));
    setMilesError("");
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
    // Only re-seed draft when a session becomes active (not on every miles save)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.active, session?.id]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === prefs.equipmentId) || vehicles[0] || null,
    [vehicles, prefs.equipmentId]
  );

  const mpg = Number(prefs.mpg) || estimateMpg(selectedVehicle);
  const gasUsd = estimateGasPriceUsd(prefs.zip);
  const gasLocal = convertFromUsd(gasUsd, prefs.currency || "USD");

  /** Live miles: prefer draft while editing so totals update instantly */
  const displayMiles = useMemo(() => {
    if (!drivingActive) return Number(session?.miles || 0);
    const parsed = parseMilesInput(milesDraft === "" ? session?.miles ?? 0 : milesDraft);
    return parsed.ok ? parsed.miles : Number(session?.miles || 0);
  }, [drivingActive, milesDraft, session?.miles]);

  const fuel = calcFuelCost({
    miles: displayMiles,
    mpg,
    gasPriceLocal: gasLocal,
    currency: prefs.currency || "USD",
  });

  const hotspots = useMemo(
    () =>
      buildHotspots({
        lat: prefs.lat,
        lng: prefs.lng,
        city: prefs.city,
        mode,
        now,
        previewPart,
      }),
    [prefs.lat, prefs.lng, prefs.city, mode, now, previewPart]
  );

  const bestNow = useMemo(() => topHotspotsNow(hotspots, 3), [hotspots]);
  const dayPart = previewPart || getDayPart(now);
  const tip = coachTip(mode, getDayPart(now));

  const mapLat = Number(prefs.lat) || hotspots[0]?.lat || 32.7767;
  const mapLng = Number(prefs.lng) || hotspots[0]?.lng || -96.797;

  const liveSession = useMemo(() => {
    if (!session) return null;
    return { ...session, miles: displayMiles };
  }, [session, displayMiles]);

  const dash = useMemo(
    () =>
      computeShiftDashboard(liveSession, stops, {
        mpg,
        gasPriceLocal: gasLocal,
        currency: prefs.currency || "USD",
      }),
    // `tick` refreshes elapsed time / earnings every second while driving
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveSession, stops, mpg, gasLocal, prefs.currency, tick]
  );

  const recorded = useMemo(() => summarizeRecordedShifts(history), [history]);

  /** Persist miles on every valid edit — no silent drops */
  const persistMilesNow = useCallback(
    (raw) => {
      if (!user?.id || !session?.active) return null;
      const parsed = parseMilesInput(raw === "" || raw == null ? 0 : raw);
      if (!parsed.ok) {
        setMilesError(parsed.error);
        return null;
      }
      setMilesError("");
      const next = updateSessionMiles(user.id, parsed.miles);
      if (next?.error) {
        setMilesError(next.error);
        return null;
      }
      setSession(next);
      return next;
    },
    [user?.id, session?.active]
  );

  // Auto-save miles while driving (debounce). Depends only on draft text to avoid save loops.
  useEffect(() => {
    if (!drivingActive || !user?.id) return undefined;
    const handle = window.setTimeout(() => {
      const parsed = parseMilesInput(milesDraft === "" || milesDraft == null ? 0 : milesDraft);
      if (!parsed.ok) {
        setMilesError(parsed.error);
        return;
      }
      setMilesError("");
      const next = updateSessionMiles(user.id, parsed.miles);
      if (next?.error) {
        setMilesError(next.error);
        return;
      }
      setSession((prev) => {
        if (!prev?.active) return prev;
        if (Number(prev.miles) === parsed.miles) return prev;
        return next;
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [milesDraft, drivingActive, user?.id]);

  const mapLit = (mode === "driving" && drivingActive) || (mode === "riding" && requestingRide);

  const updatePref = (patch) => {
    if (!user?.id) return;
    const next = { ...prefs, ...patch };
    setPrefs(savePrefs(user.id, next));
  };

  const endShiftWithMiles = async () => {
    if (!user?.id) return { ended: null, synced: { ok: false } };
    const open = (readStops(user.id) || []).find((s) => !s.ended_at);
    if (open) endStop(user.id, open.id);
    const parsed = parseMilesInput(milesDraft === "" || milesDraft == null ? session?.miles ?? 0 : milesDraft);
    if (!parsed.ok) {
      setMilesError(parsed.error);
      throw new Error(parsed.error || "Fix miles before ending");
    }
    updateSessionMiles(user.id, parsed.miles);
    const liveStops = readStops(user.id);
    const snapDash = computeShiftDashboard(
      { ...session, miles: parsed.miles, active: true },
      liveStops,
      { mpg, gasPriceLocal: gasLocal, currency: prefs.currency || "USD" }
    );
    const ended = await stopDrivingSession(user.id, {
      miles: parsed.miles,
      elapsedSec: snapDash?.elapsedSec || 0,
      hours: snapDash?.earnings?.hours || 0,
      jobsCompleted: snapDash?.jobsCompleted || 0,
      earningsGross: snapDash?.earnings?.gross || 0,
      earningsPerHour: snapDash?.earnings?.perHourEst || 0,
      fuelCost: snapDash?.fuel?.cost || 0,
      fuelGallons: snapDash?.fuel?.gallons || 0,
      profit: snapDash?.profit || 0,
      taxEstimate: snapDash?.taxEstimate || 0,
      mpg: snapDash?.mpg || mpg,
      currency: prefs.currency || "USD",
    });
    const synced = await syncSessionToTax(
      user,
      { ...ended, miles: parsed.miles },
      {
        mpg,
        gasPriceLocal: gasLocal,
        currency: prefs.currency || "USD",
        vehicleName: vehicleLabel(selectedVehicle),
      }
    );
    return { ended, synced, miles: parsed.miles };
  };

  const setMode = async (nextMode) => {
    if (!user?.id || busy) return;
    setToggleError("");
    // Prevent desync: ending an active drive when switching to passenger mode
    if (nextMode === "riding" && session?.active) {
      setBusy(true);
      try {
        await endShiftWithMiles();
        refresh();
        setMilesDraft("");
        toast({
          title: "Driving ended",
          description: "Switched to Requesting a ride — your miles and totals were saved.",
        });
      } catch (err) {
        setToggleError(err?.message || "Couldn't end driving before switching modes.");
        toast({ variant: "destructive", title: "Couldn't switch modes", description: err?.message });
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }
    updatePref({
      mode: nextMode,
      requestingRide: nextMode === "riding" ? prefs.requestingRide : false,
    });
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Location unavailable on this device" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updatePref({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast({ title: "Location updated", description: "Hotspot map centered on you." });
      },
      () =>
        toast({
          variant: "destructive",
          title: "Couldn't get location",
          description: "Enter city/ZIP manually.",
        }),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const toggleRequestingRide = () => {
    if (!user?.id || busy) return;
    setToggleError("");
    try {
      const next = !requestingRide;
      updatePref({ requestingRide: next, mode: "riding" });
      toast({
        title: next ? "Requesting a ride · ON" : "Requesting a ride · OFF",
        description: next ? "Pickup hotspots are lit on the map." : "Ride request mode ended.",
      });
    } catch (err) {
      setToggleError(err?.message || "Couldn't update ride request.");
      toast({ variant: "destructive", title: "Toggle failed", description: err?.message });
    }
  };

  const toggleDriving = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    setToggleError("");
    try {
      if (session?.active) {
        const { synced, miles } = await endShiftWithMiles();
        setSession(readSession(user.id));
        setStops(readStops(user.id));
        setHistory(readShiftHistory(user.id));
        setMilesDraft("");
        setMilesError("");
        if (synced.ok) {
          toast({
            title: "Driving ended · tax synced",
            description: `${miles} mi logged to Tax Center${
              synced.fuel?.cost ? ` · ~${currencySymbol(prefs.currency)}${synced.fuel.cost} fuel` : ""
            }.`,
          });
        } else {
          toast({
            title: "Driving ended · totals saved",
            description: `${miles} mi recorded on this device${
              miles <= 0 ? " (add miles next shift for tax sync)" : ""
            }.`,
          });
        }
      } else {
        updatePref({ mode: "driving", requestingRide: false });
        const next = await startDrivingSession(user, {
          ...prefs,
          mode: "driving",
          equipmentId: selectedVehicle?.id || prefs.equipmentId,
          mpg,
        });
        setSession(next);
        setStops([]);
        setMilesDraft("0");
        setMilesError("");
        toast({
          title: "Driving · ON",
          description: bestNow[0]
            ? `Hotspots lit. Head toward ${bestNow[0].short || bestNow[0].name} first.`
            : "Hotspots lit. Miles auto-save as you enter them.",
        });
      }
    } catch (err) {
      setToggleError(err?.message || "Couldn't update driving status.");
      refresh();
      toast({
        variant: "destructive",
        title: "Driving toggle failed",
        description: err?.message || "Try again. Your last saved state was reloaded.",
      });
    } finally {
      setBusy(false);
    }
  };

  const openStop = useMemo(() => (stops || []).find((s) => !s.ended_at) || null, [stops]);

  const handleAddStop = () => {
    if (!user?.id || !session?.active) return;
    if (openStop) {
      toast({
        title: "Stop already in progress",
        description: "Tap End stop first, then log the next one.",
      });
      return;
    }
    addStop(user.id, {});
    setStops(readStops(user.id));
    toast({ title: "Stop started", description: "Tap End stop when you leave." });
  };

  const handleEndStop = (stopId) => {
    if (!user?.id) return;
    endStop(user.id, stopId);
    setStops(readStops(user.id));
  };

  const onMilesChange = (value) => {
    setMilesDraft(value);
    const parsed = parseMilesInput(value === "" ? 0 : value);
    setMilesError(parsed.ok ? "" : parsed.error);
  };

  const saveMiles = async () => {
    if (!user?.id || !session?.active) return;
    const next = persistMilesNow(milesDraft === "" ? 0 : milesDraft);
    if (!next) {
      toast({
        variant: "destructive",
        title: "Couldn't save miles",
        description: milesError || "Enter a valid mileage.",
      });
      return;
    }
    setMilesDraft(String(next.miles));
    try {
      const synced = await syncSessionToTax(user, next, {
        mpg,
        gasPriceLocal: gasLocal,
        currency: prefs.currency || "USD",
        vehicleName: vehicleLabel(selectedVehicle),
      });
      if (synced.session) setSession(synced.session);
      toast({
        title: synced.ok ? "Miles saved · tax updated" : "Miles recorded",
        description: synced.ok
          ? "Tax Center mileage refreshed while driving."
          : `${next.miles} mi saved on this device.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Miles saved locally",
        description: err?.message || "Tax sync failed — miles are still on this shift.",
      });
    }
  };

  const sym = currencySymbol(prefs.currency || "USD");

  return (
    <div className="space-y-5">
      <FeatureHonestyBanner>
        Hotspot pins are suggested zones near your location for planning — not live third-party demand
        feeds. Miles, stops, and tax sync are live.
      </FeatureHonestyBanner>

      {/* Coach tip */}
      <div className="rounded-lg border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-card px-4 py-3 flex gap-3 items-start">
        <div className="w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Tip · {dayPartLabel(getDayPart(now))}
          </p>
          <p className="text-sm text-foreground mt-0.5 leading-snug">{tip}</p>
        </div>
      </div>

      {toggleError ? (
        <p className="text-sm text-red-400" role="alert">
          {toggleError}
        </p>
      ) : null}

      {/* Mode: Requesting a ride vs Driving */}
      <section className="glass rounded-2xl p-4 border border-border">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Mode</p>
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted border border-border">
          <button
            type="button"
            onClick={() => setMode("riding")}
            className={`flex items-center justify-center gap-2 min-h-[48px] rounded-lg text-sm font-semibold transition-colors ${
              mode === "riding"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={mode === "riding"}
          >
            <UserRound className="w-4 h-4" /> Requesting a ride
          </button>
          <button
            type="button"
            onClick={() => setMode("driving")}
            className={`flex items-center justify-center gap-2 min-h-[48px] rounded-lg text-sm font-semibold transition-colors ${
              mode === "driving"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={mode === "driving"}
          >
            <Car className="w-4 h-4" /> Driving
          </button>
        </div>
      </section>

      {/* Active session toggles */}
      <section className="glass rounded-2xl p-5 border border-border">
        {mode === "riding" ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Passenger</p>
              <h2 className="text-lg font-semibold text-foreground mt-0.5">
                {requestingRide ? "Looking for a ride" : "Need a ride?"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {requestingRide
                  ? "Map hotspots are lit for busy pickup zones."
                  : "Toggle on to light pickup hotspots near you."}
              </p>
            </div>
            <button
              type="button"
              disabled={!user?.id || busy}
              onClick={toggleRequestingRide}
              aria-busy={busy}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors disabled:opacity-60 ${
                requestingRide
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                  : "bg-muted text-foreground border border-border hover:bg-secondary"
              }`}
              aria-pressed={requestingRide}
              aria-label={requestingRide ? "Turn off requesting a ride" : "Turn on requesting a ride"}
            >
              {requestingRide ? (
                <>
                  <ToggleRight className="w-6 h-6" /> Requesting a ride · ON
                </>
              ) : (
                <>
                  <ToggleLeft className="w-6 h-6 text-muted-foreground" /> Requesting a ride · OFF
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Driver</p>
                <h2 className="text-lg font-semibold text-foreground mt-0.5">
                  {drivingActive ? "You're on the road" : "Ready when you are"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {drivingActive
                    ? `Started ${new Date(session.started_at).toLocaleTimeString()} · hotspots lit · tax syncs when you end`
                    : "Toggle on to light hotspots, track miles & stops, and sync trips to Tax Center"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !user?.id}
                onClick={toggleDriving}
                aria-busy={busy}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors disabled:opacity-60 ${
                  drivingActive
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-muted text-foreground border border-border hover:bg-secondary"
                }`}
                aria-pressed={drivingActive}
                aria-label={drivingActive ? "End driving session" : "Start driving session"}
              >
                {busy ? (
                  <>Saving…</>
                ) : drivingActive ? (
                  <>
                    <ToggleRight className="w-6 h-6" /> Driving · ON
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-6 h-6 text-muted-foreground" /> Driving · OFF
                  </>
                )}
              </button>
            </div>

            {drivingActive && dash && (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Live shift</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {formatDuration(dash.elapsedSec || 0)}
                    </p>
                    <StatHint label="Time on shift">
                      <p>How long Driving has been ON this session.</p>
                      <p>Updates every second while you&apos;re on the road.</p>
                    </StatHint>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      Miles
                      <StatHint label="Total miles">
                        <p>Miles you entered for this shift (odometer or trip app).</p>
                        <p>Totals update as you type; tap Save to store and sync tax.</p>
                      </StatHint>
                    </p>
                    <p className="text-lg font-bold text-foreground tabular-nums">{dash.miles}</p>
                  </div>
                  <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      Stops
                      <StatHint label="Stops / trips">
                        <p>Pickup or dropoff events you logged with Log stop.</p>
                        <p>Completed stops count as jobs finished.</p>
                      </StatHint>
                    </p>
                    <p className="text-lg font-bold text-foreground tabular-nums">{dash.stops}</p>
                  </div>
                  <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      Est. earn
                      <StatHint label="Estimated earnings">
                        <p>Rough gross before platform fees: time + miles + stops.</p>
                        <p>Not your real payout — use your gig app for exact pay.</p>
                      </StatHint>
                    </p>
                    <p className="text-lg font-bold text-emerald-400 tabular-nums">
                      {sym}
                      {dash.earnings.gross.toFixed(0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      Fuel
                      <StatHint label="Fuel cost">
                        <p>Miles ÷ MPG × local gas estimate from your ZIP.</p>
                        <p>Updates when miles or MPG change.</p>
                      </StatHint>
                    </p>
                    <p className="text-lg font-bold text-titan-amber tabular-nums">
                      {sym}
                      {dash.fuel.cost.toFixed(0)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      Profit
                      <StatHint label="Est. profit">
                        <p>Estimated earnings minus estimated fuel.</p>
                        <p>Does not include fees, tips, or maintenance.</p>
                      </StatHint>
                    </p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {sym}
                      {dash.profit.toFixed(0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      MPG
                      <StatHint label="Miles per gallon">
                        <p>From your vehicle setting or Fleet estimate.</p>
                        <p>Used only for fuel cost math.</p>
                      </StatHint>
                    </p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{dash.mpg}</p>
                  </div>
                  <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      <Timer className="w-3 h-3" /> Avg stop
                      <StatHint label="Average stop time">
                        <p>Average time from Log stop to End stop.</p>
                        <p>Updates when you finish a stop.</p>
                      </StatHint>
                    </p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {formatDuration(dash.avgStopSec)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-background/40 border border-border/60 px-2.5 py-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      Tax est.
                      <StatHint label="Mileage tax estimate">
                        <p>
                          {`Miles × IRS standard rate ($${IRS_MILEAGE_RATE_USD}/mi) — estimate only.`}
                        </p>
                        <p>Official logs live in Tax Center after sync.</p>
                      </StatHint>
                    </p>
                    <p className="text-sm font-semibold text-emerald-400 tabular-nums">
                      ${dash.taxEstimate.toFixed(0)}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Rough gross before platform fees
                  {dash.earnings.perHourEst > 0 ? ` · ~${sym}${dash.earnings.perHourEst}/hr` : ""}
                  {selectedVehicle ? ` · ${vehicleLabel(selectedVehicle)}` : ""}
                  {dash.jobsCompleted > 0 ? ` · ${dash.jobsCompleted} completed stops` : ""}
                </p>
              </div>
            )}

            {drivingActive && (
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="driver-hub-miles" className="text-xs text-muted-foreground">
                    Miles this session
                  </label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="driver-hub-miles"
                      type="number"
                      min="0"
                      max="9999.9"
                      step="0.1"
                      inputMode="decimal"
                      aria-invalid={Boolean(milesError)}
                      aria-describedby={milesError ? "driver-hub-miles-error" : undefined}
                      value={milesDraft !== "" ? milesDraft : String(session.miles || 0)}
                      onChange={(e) => onMilesChange(e.target.value)}
                      onBlur={() => {
                        if (milesDraft !== "" && !milesError) saveMiles();
                      }}
                      className="bg-muted border-border text-foreground rounded-xl"
                    />
                    <Button
                      type="button"
                      onClick={saveMiles}
                      variant="outline"
                      className="border-border"
                      disabled={Boolean(milesError)}
                    >
                      Save
                    </Button>
                  </div>
                  {milesError ? (
                    <p id="driver-hub-miles-error" className="text-xs text-red-400 mt-1" role="alert">
                      {milesError}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Miles auto-save as you type · Save also syncs Tax Center
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <Button
                    type="button"
                    onClick={handleAddStop}
                    disabled={Boolean(openStop)}
                    className="bg-primary text-black disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4 mr-1" /> {openStop ? "Stop in progress" : "Log stop"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleDriving}
                    disabled={busy}
                    className="border-border"
                  >
                    <Pause className="w-4 h-4 mr-1" /> End & sync tax
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Lit hotspot map — early so it's front-and-center */}
      <section className="glass rounded-2xl p-5 border border-border">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {mode === "riding" ? "Pickup hotspots" : "Driver hotspots"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {hotspots.length} zones · {dayPartLabel(dayPart)}
              {mapLit ? " · map lit for live demand" : ` · turn on ${mode === "riding" ? "Requesting a ride" : "Driving"} to light up`}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" className="border-border" onClick={detectLocation}>
            <Navigation className="w-3.5 h-3.5 mr-1" /> Use my location
          </Button>
        </div>

        {bestNow.length > 0 && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">
              Where to go {previewPart ? `(${previewPart})` : "right now"}
            </p>
            <div className="space-y-2">
              {bestNow.map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setFocusId(h.id)}
                  className="w-full flex items-start gap-2 text-sm text-left rounded-lg hover:bg-amber-500/10 p-1.5 -mx-1.5 transition-colors"
                >
                  <span className="text-amber-400 font-bold text-xs w-4 pt-0.5">{i + 1}.</span>
                  <span
                    className="mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: h.color, boxShadow: `0 0 8px ${h.color}` }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {h.name}{" "}
                      <span className="text-[10px] font-medium text-amber-400/90">· {h.when}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{h.tip}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-2 mb-3">
          <Input
            placeholder="City (Driver Location)"
            value={prefs.city || ""}
            onChange={(e) => updatePref({ city: e.target.value })}
            className="bg-muted border-border text-foreground rounded-xl"
            aria-label="Driver city"
          />
          <Input
            placeholder="ZIP (Driver Location)"
            value={prefs.zip || ""}
            onChange={(e) => updatePref({ zip: e.target.value })}
            className="bg-muted border-border text-foreground rounded-xl"
            aria-label="Driver ZIP"
          />
          <select
            value={prefs.currency || "USD"}
            onChange={(e) => updatePref({ currency: e.target.value })}
            className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-foreground text-sm"
            aria-label="Display currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          These fields are your Driver Location (maps & weather). They do not set sales tax — Job
          Location on estimates does.
        </p>

        <HotspotMap
          centerLat={mapLat}
          centerLng={mapLng}
          hotspots={hotspots}
          mode={mode}
          active={mapLit}
          dayPartFilter={previewPart}
          onDayPartFilter={setPreviewPart}
          focusId={focusId}
          onFocus={setFocusId}
        />

        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          All zones · timed tips
        </p>
        <ul className="grid sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
          {hotspots.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => setFocusId(h.id)}
                className={`w-full flex items-start gap-3 text-sm rounded-xl border px-3 py-2 text-left transition-colors ${
                  h.hotNow
                    ? "border-amber-500/40 bg-amber-500/10"
                    : focusId === h.id
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-muted/40 hover:bg-muted/70"
                }`}
              >
                <span
                  className="mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: h.color, boxShadow: mapLit ? `0 0 10px ${h.color}` : undefined }}
                />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {h.name}
                    {h.hotNow && (
                      <span className="ml-1.5 text-[10px] font-bold text-amber-400 uppercase">Hot now</span>
                    )}
                  </p>
                  <p className="text-[11px] text-amber-400/80 mt-0.5">{h.when}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{h.tip}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Fleet + fuel — driving only */}
      {mode === "driving" && (
        <section className="glass rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Car className="w-4 h-4 text-primary" /> Vehicle & fuel
              </h2>
              <p className="text-sm text-muted-foreground">Pulled from Fleet · gas estimate from your ZIP</p>
            </div>
            <Link to="/fleet" className="text-xs font-semibold text-primary hover:underline">
              Manage fleet →
            </Link>
          </div>
          {vehicles.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              No vehicle yet.{" "}
              <Link to="/fleet" className="text-primary font-semibold hover:underline">
                Add make & model in Fleet
              </Link>{" "}
              for better MPG estimates.
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Vehicle</label>
              <select
                value={prefs.equipmentId || selectedVehicle?.id || ""}
                onChange={(e) => updatePref({ equipmentId: e.target.value || null })}
                className="mt-1 w-full h-10 px-3 rounded-xl bg-muted border border-border text-foreground text-sm"
              >
                {vehicles.length === 0 && <option value="">Add a vehicle in Fleet first</option>}
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleLabel(v)}
                    {v.make || v.brand ? "" : v.category ? ` (${v.category})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">MPG</label>
              <Input
                type="number"
                min="1"
                placeholder={`est. ${estimateMpg(selectedVehicle)}`}
                value={prefs.mpg ?? ""}
                onChange={(e) => updatePref({ mpg: e.target.value ? Number(e.target.value) : null })}
                className="mt-1 bg-muted border-border text-foreground rounded-xl"
              />
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-muted/60 border border-border p-4 flex items-start gap-3">
            <Fuel className="w-5 h-5 text-titan-amber flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                ~{sym}
                {gasLocal.toFixed(2)} / gal equivalent in {prefs.currency || "USD"}
              </p>
              <p className="text-muted-foreground mt-1">
                Using ZIP {prefs.zip || "—"} regional average (~${gasUsd.toFixed(2)} USD). At {mpg} mpg,{" "}
                {displayMiles || "—"} mi ≈ {fuel.gallons} gal · {sym}
                {fuel.cost} ({sym}
                {fuel.perMile}/mi).
              </p>
            </div>
          </div>
        </section>
      )}

      {mode === "driving" && (
        <section className="glass rounded-2xl p-5 border border-border">
          <h2 className="text-base font-semibold text-foreground mb-3">Stops this session</h2>
          {stops.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stops yet. Turn Driving ON, then tap Log stop at each pickup/dropoff.
            </p>
          ) : (
            <ul className="space-y-2">
              {stops.map((s, i) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Stop {stops.length - i}
                      {!s.ended_at && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-emerald-400">Live</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.ended_at
                        ? `${formatDuration(s.duration_sec)} · gap ${formatDuration(s.between_orders_sec)}`
                        : "In progress…"}
                    </p>
                  </div>
                  {!s.ended_at && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-border"
                      onClick={() => handleEndStop(s.id)}
                    >
                      End stop
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            When you end Driving, mileage + estimated fuel go into{" "}
            <Link to="/tax-center" className="text-primary hover:underline">
              Tax Center
            </Link>
            .
          </p>
        </section>
      )}

      {mode === "driving" && (
        <section className="glass rounded-2xl p-5 border border-border" aria-label="Recorded driver totals">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Recorded totals</h2>
              <p className="text-sm text-muted-foreground">
                {drivingActive
                  ? "Live shift numbers update as you drive. Past shifts stay listed below."
                  : recorded.shifts > 0
                    ? `${recorded.shifts} saved shift${recorded.shifts === 1 ? "" : "s"} on this device`
                    : "Turn Driving ON and enter miles — every number is saved when you end."}
              </p>
            </div>
          </div>

          {drivingActive && dash ? (
            <p className="text-sm text-muted-foreground mb-4">
              Live numbers are in the shift card above. Saved shifts with full totals are listed here when
              you end Driving.
            </p>
          ) : null}

          {!drivingActive && recorded.shifts > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Total miles</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{recorded.miles}</p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Stops</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{recorded.stops}</p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Hours</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{recorded.hours}</p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Jobs done</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{recorded.jobsCompleted}</p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Est. earn</p>
                <p className="text-lg font-bold text-emerald-400 tabular-nums">
                  {sym}
                  {recorded.earnings.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Fuel</p>
                <p className="text-lg font-bold text-titan-amber tabular-nums">
                  {sym}
                  {recorded.fuel.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Profit</p>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {sym}
                  {recorded.profit.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Tax est.</p>
                <p className="text-lg font-bold text-emerald-400 tabular-nums">
                  ${recorded.taxEstimate.toFixed(2)}
                </p>
              </div>
            </div>
          ) : null}

          {history.length > 0 ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Recent shifts
              </p>
              <ul className="space-y-2">
                {history.slice(0, 8).map((s) => {
                  const mins =
                    s.elapsed_sec != null
                      ? Math.round(Number(s.elapsed_sec) / 60)
                      : s.started_at && s.ended_at
                        ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000)
                        : 0;
                  const shiftSym = currencySymbol(s.currency || prefs.currency || "USD");
                  return (
                    <li
                      key={s.id}
                      className="rounded-xl border border-border bg-muted/40 px-3 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="font-medium text-foreground">
                          {s.started_at ? new Date(s.started_at).toLocaleDateString() : "Shift"}
                        </p>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {s.ended_at
                            ? new Date(s.ended_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Miles:{" "}
                          <strong className="text-foreground tabular-nums">{Number(s.miles) || 0}</strong>
                        </span>
                        <span>
                          Stops:{" "}
                          <strong className="text-foreground tabular-nums">{Number(s.stops) || 0}</strong>
                        </span>
                        <span>
                          Time:{" "}
                          <strong className="text-foreground tabular-nums">{mins} min</strong>
                        </span>
                        <span>
                          Jobs:{" "}
                          <strong className="text-foreground tabular-nums">
                            {Number(s.jobs_completed) || 0}
                          </strong>
                        </span>
                        <span>
                          Earn:{" "}
                          <strong className="text-emerald-400 tabular-nums">
                            {shiftSym}
                            {Number(s.earnings_gross || 0).toFixed(2)}
                          </strong>
                        </span>
                        <span>
                          Fuel:{" "}
                          <strong className="text-titan-amber tabular-nums">
                            {shiftSym}
                            {Number(s.fuel_cost || 0).toFixed(2)}
                          </strong>
                        </span>
                        <span>
                          Profit:{" "}
                          <strong className="text-foreground tabular-nums">
                            {shiftSym}
                            {Number(s.profit || 0).toFixed(2)}
                          </strong>
                        </span>
                        <span>
                          Tax:{" "}
                          <strong className="text-emerald-400 tabular-nums">
                            ${Number(s.tax_estimate || 0).toFixed(2)}
                          </strong>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : !drivingActive ? (
            <p className="text-sm text-muted-foreground">
              No shifts recorded yet. Start Driving, enter miles, then End — totals stay here.
            </p>
          ) : null}
        </section>
      )}

      {/* Emergency — last so driving tools stay uninterrupted */}
      <section className="glass rounded-2xl p-5 border border-red-500/30 bg-red-500/5">
        <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
          <Siren className="w-4 h-4 text-red-400" /> Emergency
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          If you are in danger or need urgent help, use the link below. It opens your phone&apos;s emergency call.
        </p>
        <a
          href="tel:911"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-5 py-3 transition-colors"
        >
          <Phone className="w-4 h-4" /> Call emergency (911)
        </a>
      </section>
    </div>
  );
}
