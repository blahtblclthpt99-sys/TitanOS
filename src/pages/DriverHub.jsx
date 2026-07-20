import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Car,
  Clock,
  Fuel,
  MapPin,
  Navigation,
  Pause,
  Play,
  Plus,
  Route,
  Timer,
  ToggleLeft,
  ToggleRight,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import HotspotMap from "@/components/driver/HotspotMap";
import { toast } from "@/components/ui/use-toast";
import {
  DRIVER_APPS,
  RIDER_APPS,
  addStop,
  buildHotspots,
  calcFuelCost,
  coachTip,
  convertFromUsd,
  currencySymbol,
  dayPartLabel,
  endStop,
  estimateGasPriceUsd,
  estimateMpg,
  estimateShiftEarnings,
  formatDuration,
  getDayPart,
  listDriverVehicles,
  openDriverApp,
  readPrefs,
  readSession,
  readShiftHistory,
  readStops,
  savePrefs,
  sessionStats,
  startDrivingSession,
  stopDrivingSession,
  syncSessionToTax,
  topHotspotsNow,
  updateSessionMiles,
} from "@/lib/driverHubApi";
import { vehicleLabel } from "@/lib/vehicleCatalog";

const CURRENCIES = ["USD", "CAD", "MXN", "EUR", "GBP", "AUD", "JPY", "BRL"];

export default function DriverHub() {
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
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [session?.active]);

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
  const fuel = calcFuelCost({
    miles: Number(session?.miles || milesDraft || 0),
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
  const stats = sessionStats(session, stops);
  const earnings = estimateShiftEarnings({
    miles: stats?.miles || 0,
    elapsedSec: stats?.elapsedSec || 0,
    stops: stats?.stops || 0,
  });
  void tick;

  const mapLit = (mode === "driving" && drivingActive) || (mode === "riding" && requestingRide);

  const updatePref = (patch) => {
    if (!user?.id) return;
    const next = { ...prefs, ...patch };
    setPrefs(savePrefs(user.id, next));
  };

  const setMode = (nextMode) => {
    updatePref({
      mode: nextMode,
      // turning off the other mode's "active" request flag when switching
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
    if (!user?.id) return;
    const next = !requestingRide;
    updatePref({ requestingRide: next, mode: "riding" });
    toast({
      title: next ? "Requesting a ride · ON" : "Requesting a ride · OFF",
      description: next
        ? "Hotspots lit for pickup zones. Open Uber or Lyft to request."
        : "Ride request mode ended.",
    });
  };

  const toggleDriving = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      if (session?.active) {
        const miles = Number(milesDraft || session.miles || 0);
        updateSessionMiles(user.id, miles);
        const ended = await stopDrivingSession(user.id);
        const synced = await syncSessionToTax(
          user,
          { ...ended, miles },
          {
            mpg,
            gasPriceLocal: gasLocal,
            currency: prefs.currency || "USD",
            vehicleName: vehicleLabel(selectedVehicle),
          }
        );
        refresh();
        setMilesDraft("");
        setHistory(readShiftHistory(user.id));
        if (synced.ok) {
          toast({
            title: "Driving ended · tax synced",
            description: `${miles} mi logged to Tax Center${
              synced.fuel?.cost ? ` · ~${currencySymbol(prefs.currency)}${synced.fuel.cost} fuel` : ""
            }.`,
          });
        } else {
          toast({ title: "Driving ended", description: "Add miles next time to auto-fill tax." });
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
        toast({
          title: "Driving · ON",
          description: bestNow[0]
            ? `Hotspots lit. Head toward ${bestNow[0].short || bestNow[0].name} first.`
            : "Hotspots lit. Open a gig app and log stops.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddStop = () => {
    if (!user?.id || !session?.active) return;
    addStop(user.id, { app: (prefs.connectedApps || [])[0] || "" });
    setStops(readStops(user.id));
    toast({ title: "Stop started", description: "Tap End stop when you leave." });
  };

  const handleEndStop = (stopId) => {
    if (!user?.id) return;
    endStop(user.id, stopId);
    setStops(readStops(user.id));
  };

  const saveMiles = async () => {
    if (!user?.id || !session?.active) return;
    const next = updateSessionMiles(user.id, milesDraft);
    setSession(next);
    const synced = await syncSessionToTax(user, next, {
      mpg,
      gasPriceLocal: gasLocal,
      currency: prefs.currency || "USD",
      vehicleName: vehicleLabel(selectedVehicle),
    });
    if (synced.session) setSession(synced.session);
    toast({
      title: synced.ok ? "Miles saved · tax updated" : "Miles updated",
      description: synced.ok ? "Tax Center mileage refreshed while driving." : undefined,
    });
  };

  const toggleApp = (appId) => {
    const set = new Set(prefs.connectedApps || []);
    if (set.has(appId)) set.delete(appId);
    else set.add(appId);
    updatePref({ connectedApps: [...set] });
  };

  const sym = currencySymbol(prefs.currency || "USD");
  const apps = mode === "riding" ? RIDER_APPS : DRIVER_APPS;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Driver Hub"
        subtitle="Request a ride or drive · live heat map, timed tips, mileage & tax"
      />

      {/* Coach tip */}
      <div className="rounded-2xl border border-titan-cyan/25 bg-gradient-to-r from-titan-cyan/10 via-card to-card px-4 py-3 flex gap-3 items-start">
        <div className="w-9 h-9 rounded-xl bg-titan-cyan/15 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-titan-cyan" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-titan-cyan">
            Tip · {dayPartLabel(getDayPart(now))}
          </p>
          <p className="text-sm text-foreground mt-0.5 leading-snug">{tip}</p>
        </div>
      </div>

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
                  ? "Map hotspots are lit for busy pickup zones — open Uber or Lyft to request."
                  : "Toggle on to light pickup hotspots and jump into a rideshare app."}
              </p>
            </div>
            <button
              type="button"
              disabled={!user?.id}
              onClick={toggleRequestingRide}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors ${
                requestingRide
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                  : "bg-muted text-foreground border border-border hover:bg-secondary"
              }`}
              aria-pressed={requestingRide}
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
                    ? `Started ${new Date(session.started_at).toLocaleTimeString()} · hotspots lit · tax auto-fills when you stop`
                    : "Toggle on to light hotspots, track miles/stops, and push trips into Tax Center"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !user?.id}
                onClick={toggleDriving}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors ${
                  drivingActive
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-muted text-foreground border border-border hover:bg-secondary"
                }`}
                aria-pressed={drivingActive}
              >
                {drivingActive ? (
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

            {drivingActive && (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Live shift</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatDuration(stats?.elapsedSec || 0)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Miles</p>
                    <p className="text-lg font-bold text-foreground tabular-nums">{stats?.miles || 0}</p>
                  </div>
                  <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Stops</p>
                    <p className="text-lg font-bold text-foreground tabular-nums">{stats?.stops || 0}</p>
                  </div>
                  <div className="rounded-xl bg-background/50 border border-border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Est. ${prefs.currency || "USD"}</p>
                    <p className="text-lg font-bold text-emerald-400 tabular-nums">
                      {sym}
                      {earnings.gross.toFixed(0)}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Rough gross before platform fees · ~{sym}
                  {earnings.perHourEst}/hr
                  {selectedVehicle ? ` · ${vehicleLabel(selectedVehicle)}` : ""}
                </p>
              </div>
            )}

            {drivingActive && (
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Miles this session</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={milesDraft !== "" ? milesDraft : String(session.miles || 0)}
                      onChange={(e) => setMilesDraft(e.target.value)}
                      className="bg-muted border-border text-foreground rounded-xl"
                    />
                    <Button type="button" onClick={saveMiles} variant="outline" className="border-border">
                      Save
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <Button type="button" onClick={handleAddStop} className="bg-titan-cyan text-black">
                    <Plus className="w-4 h-4 mr-1" /> Log stop
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

            {stats && drivingActive && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Miles", value: stats.miles, icon: Route },
                  { label: "Stops", value: stats.stops, icon: MapPin },
                  { label: "Avg stop", value: formatDuration(stats.avgStopSec), icon: Timer },
                  { label: "Between orders", value: formatDuration(stats.avgBetweenSec), icon: Clock },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-muted/60 border border-border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <item.icon className="w-3 h-3" /> {item.label}
                    </p>
                    <p className="text-lg font-semibold text-foreground mt-1">{item.value}</p>
                  </div>
                ))}
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
              {mode === "riding" ? "Pickup hotspots" : "Delivery & rideshare hotspots"}
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
            placeholder="City"
            value={prefs.city || ""}
            onChange={(e) => updatePref({ city: e.target.value })}
            className="bg-muted border-border text-foreground rounded-xl"
          />
          <Input
            placeholder="ZIP / postal"
            value={prefs.zip || ""}
            onChange={(e) => updatePref({ zip: e.target.value })}
            className="bg-muted border-border text-foreground rounded-xl"
          />
          <select
            value={prefs.currency || "USD"}
            onChange={(e) => updatePref({ currency: e.target.value })}
            className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-foreground text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

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
                      ? "border-titan-cyan/40 bg-titan-cyan/10"
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

      {/* Connect apps */}
      <section className="glass rounded-2xl p-5 border border-border">
        <h2 className="text-base font-semibold text-foreground mb-1">
          {mode === "riding" ? "Request in these apps" : "Connect gig apps"}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {mode === "riding"
            ? "Opens Uber or Lyft so you can request a ride. Hotspots stay lit in Titan."
            : "Opens the partner driver/dasher app. Titan tracks your session separately."}
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {apps.map((app) => {
            const connected = (prefs.connectedApps || []).includes(app.id);
            return (
              <div key={app.id} className="rounded-xl border border-border bg-muted/40 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: app.color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{app.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{app.type}</p>
                    </div>
                  </div>
                  {mode === "driving" && (
                    <button
                      type="button"
                      onClick={() => toggleApp(app.id)}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                        connected ? "bg-emerald-500/15 text-emerald-400" : "bg-background text-muted-foreground"
                      }`}
                    >
                      {connected ? "Linked" : "Link"}
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-border w-full"
                  onClick={() => openDriverApp(app)}
                >
                  <Play className="w-3.5 h-3.5 mr-1" /> Open {app.name}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fleet + fuel — driving only */}
      {mode === "driving" && (
        <section className="glass rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Car className="w-4 h-4 text-titan-cyan" /> Vehicle & fuel
              </h2>
              <p className="text-sm text-muted-foreground">Pulled from Fleet · AI gas estimate for your ZIP</p>
            </div>
            <Link to="/fleet" className="text-xs font-semibold text-titan-cyan hover:underline">
              Manage fleet →
            </Link>
          </div>
          {vehicles.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              No vehicle yet.{" "}
              <Link to="/fleet" className="text-titan-cyan font-semibold hover:underline">
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
                placeholder="e.g. 28"
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
                {Number(session?.miles || milesDraft || 0) || "—"} mi ≈ {fuel.gallons} gal · {sym}
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
                    <p className="text-sm font-medium text-foreground">Stop {stops.length - i}</p>
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
            Tip: when Driving is ON and you end the session, mileage + estimated fuel go into{" "}
            <Link to="/tax-center" className="text-titan-cyan hover:underline">
              Tax Center
            </Link>
            .
          </p>
        </section>
      )}

      {mode === "driving" && history.length > 0 && (
        <section className="glass rounded-2xl p-5 border border-border">
          <h2 className="text-base font-semibold text-foreground mb-3">Recent shifts</h2>
          <ul className="space-y-2">
            {history.slice(0, 5).map((s) => {
              const mins = s.started_at && s.ended_at
                ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000)
                : 0;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {s.started_at ? new Date(s.started_at).toLocaleDateString() : "Shift"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.miles || 0} mi · {s.stops || 0} stops · {mins} min
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {s.ended_at ? new Date(s.ended_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
