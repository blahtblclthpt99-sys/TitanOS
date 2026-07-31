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
  ToggleLeft,
  ToggleRight,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HotspotMap from "@/components/driver/HotspotMap";
import ActivityLiveDash from "@/components/driver/activity/ActivityLiveDash";
import SetForgetOfferPanel from "@/components/driver/activity/SetForgetOfferPanel";
import DriverVoiceCoach from "@/components/driver/activity/DriverVoiceCoach";
import ActivityStatsPanel from "@/components/driver/activity/ActivityStatsPanel";
import BetweenStopsPanel from "@/components/driver/activity/BetweenStopsPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import { toast } from "@/components/ui/use-toast";
import {
  classifyRushWindow,
  collectTrips,
  filterTripsByPeriod,
  summarizeTrips,
  composeSmartCoachTip,
} from "@/lib/driverActivity";
import { DRIVER_SESSION_EVENT } from "@/lib/driverOs";
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
  pauseDrivingSession,
  readPrefs,
  readSession,
  readShiftHistory,
  readStops,
  renameStop,
  resumeDrivingSession,
  savePrefs,
  summarizeProfitGrowth,
  startDrivingSession,
  stopDrivingSession,
  syncSessionToTax,
  topHotspotsNow,
  updateSessionMiles,
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
  const [voiceSeed, setVoiceSeed] = useState(null);
  const [milesDraft, setMilesDraft] = useState("");
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [previewPart, setPreviewPart] = useState(null);
  const [focusId, setFocusId] = useState(null);

  const [milesError, setMilesError] = useState("");
  const [toggleError, setToggleError] = useState("");
  const [gpsError, setGpsError] = useState("");
  const [reviewSessionId, setReviewSessionId] = useState(null);

  const mode = prefs.mode === "riding" ? "riding" : "driving";
  const requestingRide = Boolean(prefs.requestingRide);
  const drivingActive = Boolean(session?.active);
  const sessionPaused = Boolean(session?.paused);

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

  // Live session/telemetry from KeepAlive (survives refresh + other tabs/pages)
  useEffect(() => {
    if (!user?.id) return undefined;
    const onChange = () => refresh();
    window.addEventListener(DRIVER_SESSION_EVENT, onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(DRIVER_SESSION_EVENT, onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [user?.id, refresh]);

  useEffect(() => {
    if (!user?.id) return;
    listDriverVehicles(user.id).then(setVehicles).catch(() => setVehicles([]));
  }, [user?.id]);

  useEffect(() => {
    if (!session?.active) return undefined;
    setMilesDraft(String(session.miles ?? 0));
    setMilesError("");
    let id = null;
    const arm = () => {
      if (id != null) window.clearInterval(id);
      id = null;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      id = window.setInterval(() => setTick((n) => n + 1), 1000);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      document.removeEventListener("visibilitychange", arm);
      if (id != null) window.clearInterval(id);
    };
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
  const tip = useMemo(() => {
    const week = user?.id
      ? summarizeTrips(
          filterTripsByPeriod(
            collectTrips(history, null, [], {
              mpg,
              gasUsd: typeof gasUsd === "number" ? gasUsd : 3.5,
              userId: user.id,
            }).sessions,
            "week"
          )
        )
      : null;
    const smart = composeSmartCoachTip({
      mode,
      dayPart: getDayPart(now),
      rush: classifyRushWindow(now),
      mpg,
      gasUsd: typeof gasUsd === "number" ? gasUsd : 3.5,
      userId: user?.id || null,
      weekSummary: week,
    });
    return smart.full || coachTip(mode, getDayPart(now));
  }, [mode, now, user?.id, history, mpg, gasUsd]);

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
  const profitGrowth = useMemo(
    () =>
      summarizeProfitGrowth(history, {
        installedAt: new Date(Date.now() - 140 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    [history]
  );

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
      earningsGross: 0,
      earningsPerHour: 0,
      fuelCost: snapDash?.fuel?.cost || 0,
      fuelGallons: snapDash?.fuel?.gallons || 0,
      profit: 0,
      taxEstimate: snapDash?.taxEstimate || 0,
      mpg: snapDash?.mpg || mpg,
      currency: prefs.currency || "USD",
      driveSec: snapDash?.driveSec || session?.drive_sec || 0,
      idleSec: snapDash?.idleSec || session?.idle_sec || 0,
      maxSpeedMph: snapDash?.maxSpeedMph || session?.max_speed_mph || 0,
      avgSpeedMph: snapDash?.avgSpeedMph || session?.avg_speed_mph || 0,
      autoMiles: session?.auto_miles || 0,
      milesSource: session?.miles_source || "manual",
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
          title: "Work session · ON",
          description: prefs.autoTrack !== false && prefs.locationPrivacyAck
            ? "GPS tracking started. Miles and stops update automatically — glance only while driving."
            : bestNow[0]
              ? `Hotspots lit. Head toward ${bestNow[0].short || bestNow[0].name} first.`
              : "Session started. Enable Auto GPS below or enter miles manually.",
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

  const handlePauseSession = () => {
    if (!user?.id) return;
    const next = pauseDrivingSession(user.id);
    setSession(next);
    toast({ title: "Tracking paused", description: "Resume when you continue the work session." });
  };

  const handleResumeSession = () => {
    if (!user?.id) return;
    const next = resumeDrivingSession(user.id);
    setSession(next);
    toast({ title: "Tracking resumed" });
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
        Work sessions auto-track GPS miles and stops while Driving is ON (after you allow
        location). Hotspot pins are planning suggestions — not live third-party demand. Tax
        mileage sync is for recordkeeping only, not tax advice.
      </FeatureHonestyBanner>

      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Location & privacy</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          TitanOS collects GPS only during an active work session when Auto GPS is on. We do not
          track in the background unless you explicitly enable a future background option. You can
          pause or end the session anytime. Route points stay on this device (last ~400 samples).
        </p>
        <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(prefs.locationPrivacyAck)}
            onChange={(e) => updatePref({ locationPrivacyAck: e.target.checked })}
          />
          <span>I understand location is used for mileage and stop detection during work sessions.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={prefs.autoTrack !== false}
            onChange={(e) => updatePref({ autoTrack: e.target.checked })}
          />
          <span>Auto GPS miles & stop detection (recommended for hauling / delivery)</span>
        </label>
      </div>

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
      <section className="titan-surface p-4 border border-border">
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
      <section className="titan-surface p-5 border border-border">
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
              <ErrorBoundary message="Live session dash couldn't load.">
                <ActivityLiveDash
                  dash={dash}
                  stopPhase={session?.stop_phase || dash.stopPhase}
                  paused={sessionPaused}
                  milesSource={session?.miles_source || dash.milesSource}
                  onPause={handlePauseSession}
                  onResume={handleResumeSession}
                  busy={busy}
                  rushLabel={classifyRushWindow(new Date()).label}
                />
              </ErrorBoundary>
            )}

            <ErrorBoundary message="Offer autopilot couldn't load.">
              <SetForgetOfferPanel
                userId={user?.id}
                mpg={Number(prefs.mpg) || 22}
                gasUsd={typeof gasUsd === "number" ? gasUsd : 3.5}
                defaultZip={prefs.zip || ""}
                history={history}
                drivingActive={drivingActive}
                voiceSeed={voiceSeed}
              />
            </ErrorBoundary>

            <ErrorBoundary message="Voice coach couldn't load.">
              <DriverVoiceCoach
                userId={user?.id}
                mpg={Number(prefs.mpg) || mpg || 22}
                gasUsd={typeof gasUsd === "number" ? gasUsd : 3.5}
                defaultZip={prefs.zip || ""}
                history={history}
                drivingActive={drivingActive}
                sessionPaused={sessionPaused}
                dash={dash}
                onStartDriving={async () => {
                  if (!drivingActive) await toggleDriving();
                }}
                onStopDriving={async () => {
                  if (drivingActive) await toggleDriving();
                }}
                onPause={handlePauseSession}
                onResume={handleResumeSession}
                onDecision={(decision, input) => setVoiceSeed({ decision, input, at: Date.now() })}
              />
            </ErrorBoundary>

            {drivingActive && gpsError && (
              <p className="mt-2 text-xs text-titan-amber" role="status">
                {gpsError}
              </p>
            )}

            {drivingActive && (
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="driver-hub-miles" className="text-xs text-muted-foreground">
                    Miles this session
                    {session?.miles_source === "gps" ? " (auto — correct if needed)" : " (manual)"}
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
                      GPS updates miles automatically when Auto GPS is on · Save syncs Tax Center
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
      <section className="titan-surface p-5 border border-border">
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
        <section className="titan-surface p-5 border border-border">
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
                {Number(gasLocal || 0).toFixed(2)} / gal equivalent in {prefs.currency || "USD"}
              </p>
              <p className="text-muted-foreground mt-1">
                Using ZIP {prefs.zip || "—"} regional average (~${Number(gasUsd || 0).toFixed(2)} USD). At {mpg} mpg,{" "}
                {displayMiles || "—"} mi ≈ {fuel.gallons} gal · {sym}
                {Number(fuel.cost || 0).toFixed(2)} ({sym}
                {Number(fuel.perMile || 0).toFixed(3)}/mi).
              </p>
            </div>
          </div>
        </section>
      )}

      {mode === "driving" && session && (
        <section className="titan-surface p-5 border border-border">
          <ErrorBoundary message="Time between stops couldn't load. Other shift tools still work.">
            <BetweenStopsPanel
              session={session}
              stops={stops}
              tick={tick}
              onRenameStop={(id, label) => {
                if (!user?.id) return;
                renameStop(user.id, id, label);
                setStops(readStops(user.id));
              }}
            />
          </ErrorBoundary>
          {openStop ? (
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => handleEndStop(openStop.id)}>
                End current stop
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground mt-4">
            When you end the work session, mileage and estimated fuel go into{" "}
            <Link to="/tax-center" className="text-primary hover:underline">
              Tax Center
            </Link>{" "}
            for recordkeeping.
          </p>
        </section>
      )}

      {mode === "driving" && (
        <ErrorBoundary message="Driver statistics couldn't load. Try refresh.">
          <ActivityStatsPanel history={history} liveSession={drivingActive ? session : null} stops={stops} />
        </ErrorBoundary>
      )}

      {mode === "driving" && (
        <section className="titan-surface p-5 border border-border" aria-label="Recorded driver totals">
          {history.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    Profit growth
                  </p>
                  <p className="text-2xl font-semibold text-foreground mt-1">
                    {profitGrowth.growthPct > 0 ? "+" : ""}
                    {profitGrowth.growthPct.toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your average shift profit is up from about {sym}
                    {profitGrowth.baselineProfit.toFixed(2)} to {sym}
                    {profitGrowth.currentProfit.toFixed(2)} since install day.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-background/70 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Since install</p>
                  <p className="text-sm font-semibold text-foreground">{profitGrowth.daysSinceInstall} days</p>
                </div>
              </div>
            </div>
          ) : null}

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
                <p className="text-[10px] text-muted-foreground uppercase">Drive hours</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{recorded.hours}</p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Trips</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{recorded.shifts}</p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Fuel est.</p>
                <p className="text-lg font-bold text-titan-amber tabular-nums">
                  {sym}
                  {Number(recorded.fuel || 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Deductible est.</p>
                <p className="text-lg font-bold text-emerald-500 tabular-nums">
                  ${(Number(recorded.taxEstimate) || 0).toFixed(2)}
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
                          Drive:{" "}
                          <strong className="text-foreground tabular-nums">
                            {formatDuration(Number(s.drive_sec) || Number(s.elapsed_sec) || mins * 60)}
                          </strong>
                        </span>
                        <span>
                          Idle:{" "}
                          <strong className="text-foreground tabular-nums">
                            {formatDuration(Number(s.idle_sec) || 0)}
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
                          Deductible:{" "}
                          <strong className="text-emerald-500 tabular-nums">
                            ${Number(s.tax_estimate || 0).toFixed(2)}
                          </strong>
                        </span>
                      </div>
                      {Array.isArray(s.stops_detail) && s.stops_detail.length > 0 ? (
                        <div className="mt-2">
                          <button
                            type="button"
                            className="text-xs text-primary underline-offset-2 hover:underline"
                            onClick={() =>
                              setReviewSessionId((id) => (id === s.id ? null : s.id))
                            }
                          >
                            {reviewSessionId === s.id ? "Hide timeline" : "Review timeline & between stops"}
                          </button>
                          {reviewSessionId === s.id ? (
                            <div className="mt-3 border-t border-border pt-3">
                              <BetweenStopsPanel session={s} stops={s.stops_detail} />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
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
      <section className="titan-surface p-5 border border-red-500/30 bg-red-500/5">
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
