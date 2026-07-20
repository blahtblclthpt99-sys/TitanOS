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
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "@/components/ui/use-toast";
import {
  DRIVER_APPS,
  addStop,
  buildHotspots,
  calcFuelCost,
  convertFromUsd,
  currencySymbol,
  endStop,
  estimateGasPriceUsd,
  estimateMpg,
  formatDuration,
  listDriverVehicles,
  openDriverApp,
  openStreetMapEmbed,
  readPrefs,
  readSession,
  readStops,
  savePrefs,
  sessionStats,
  startDrivingSession,
  stopDrivingSession,
  syncSessionToTax,
  updateSessionMiles,
} from "@/lib/driverHubApi";

const CURRENCIES = ["USD", "CAD", "MXN", "EUR", "GBP", "AUD", "JPY", "BRL"];

export default function DriverHub() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(() => readPrefs(user?.id));
  const [session, setSession] = useState(() => readSession(user?.id));
  const [stops, setStops] = useState(() => readStops(user?.id));
  const [vehicles, setVehicles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [milesDraft, setMilesDraft] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    if (!user?.id) return;
    setPrefs(readPrefs(user.id));
    setSession(readSession(user.id));
    setStops(readStops(user.id));
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
    () => buildHotspots({ lat: prefs.lat, lng: prefs.lng, city: prefs.city }),
    [prefs.lat, prefs.lng, prefs.city]
  );

  const mapLat = Number(prefs.lat) || hotspots[0]?.lat || 32.7767;
  const mapLng = Number(prefs.lng) || hotspots[0]?.lng || -96.797;
  const stats = sessionStats(session, stops);
  void tick;

  const updatePref = (patch) => {
    if (!user?.id) return;
    const next = { ...prefs, ...patch };
    setPrefs(savePrefs(user.id, next));
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
      () => toast({ variant: "destructive", title: "Couldn't get location", description: "Enter city/ZIP manually." }),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const toggleDriving = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      if (session?.active) {
        const miles = Number(milesDraft || session.miles || 0);
        updateSessionMiles(user.id, miles);
        const ended = await stopDrivingSession(user.id);
        const synced = await syncSessionToTax(user, { ...ended, miles }, {
          mpg,
          gasPriceLocal: gasLocal,
          currency: prefs.currency || "USD",
          vehicleName: selectedVehicle?.name,
        });
        refresh();
        setMilesDraft("");
        if (synced.ok) {
          toast({
            title: "Driving ended · tax synced",
            description: `${miles} mi logged to Tax Center${synced.fuel?.cost ? ` · ~${currencySymbol(prefs.currency)}${synced.fuel.cost} fuel` : ""}.`,
          });
        } else {
          toast({ title: "Driving ended", description: "Add miles next time to auto-fill tax." });
        }
      } else {
        const next = await startDrivingSession(user, {
          ...prefs,
          equipmentId: selectedVehicle?.id || prefs.equipmentId,
          mpg,
        });
        setSession(next);
        setStops([]);
        setMilesDraft("0");
        toast({
          title: "Driving started",
          description: "Open a gig app, log stops, and miles sync to Tax when you end.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddStop = () => {
    if (!user?.id || !session?.active) return;
    const stop = addStop(user.id, { app: (prefs.connectedApps || [])[0] || "" });
    setStops(readStops(user.id));
    toast({ title: "Stop started", description: "Tap End stop when you leave." });
    return stop;
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
      vehicleName: selectedVehicle?.name,
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

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Driver Hub"
        subtitle="Rideshare & food delivery · hotspots, mileage, fuel & tax"
      />

      {/* Start driving */}
      <section className="glass rounded-2xl p-5 border border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Session</p>
            <h2 className="text-lg font-semibold text-foreground mt-0.5">
              {session?.active ? "You're on the road" : "Ready when you are"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {session?.active
                ? `Started ${new Date(session.started_at).toLocaleTimeString()} · tax auto-fills when you stop`
                : "Toggle on to track miles, stops, and push trips into Tax Center"}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || !user?.id}
            onClick={toggleDriving}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors ${
              session?.active
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-muted text-foreground border border-border hover:bg-secondary"
            }`}
            aria-pressed={Boolean(session?.active)}
          >
            {session?.active ? (
              <>
                <ToggleRight className="w-6 h-6" /> Start driving · ON
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6 text-muted-foreground" /> Start driving · OFF
              </>
            )}
          </button>
        </div>

        {session?.active && (
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
              <Button type="button" variant="outline" onClick={toggleDriving} disabled={busy} className="border-border">
                <Pause className="w-4 h-4 mr-1" /> End & sync tax
              </Button>
            </div>
          </div>
        )}

        {stats && (
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
      </section>

      {/* Connect apps */}
      <section className="glass rounded-2xl p-5 border border-border">
        <h2 className="text-base font-semibold text-foreground mb-1">Connect gig apps</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Opens the partner app (or signup) on your device. Titan tracks your session separately.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DRIVER_APPS.map((app) => {
            const connected = (prefs.connectedApps || []).includes(app.id);
            return (
              <div
                key={app.id}
                className="rounded-xl border border-border bg-muted/40 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: app.color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{app.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{app.type}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleApp(app.id)}
                    className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                      connected ? "bg-emerald-500/15 text-emerald-400" : "bg-background text-muted-foreground"
                    }`}
                  >
                    {connected ? "Linked" : "Link"}
                  </button>
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

      {/* Hotspots map */}
      <section className="glass rounded-2xl p-5 border border-border">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Delivery hotspots</h2>
            <p className="text-sm text-muted-foreground">Color-marked demand zones near you</p>
          </div>
          <Button type="button" size="sm" variant="outline" className="border-border" onClick={detectLocation}>
            <Navigation className="w-3.5 h-3.5 mr-1" /> Use my location
          </Button>
        </div>
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
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted aspect-[16/10]">
          <iframe
            title="Driver hotspot map"
            className="absolute inset-0 w-full h-full"
            src={openStreetMapEmbed(mapLat, mapLng, 12)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <ul className="mt-3 space-y-2">
          {hotspots.map((h) => (
            <li key={h.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: h.color }} />
              <div>
                <p className="font-medium text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.tip}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Fleet + fuel */}
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
                  {v.name} ({v.category})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">MPG / MPGe (override)</label>
            <Input
              type="number"
              min="1"
              placeholder={String(estimateMpg(selectedVehicle))}
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

      {/* Stops list */}
      <section className="glass rounded-2xl p-5 border border-border">
        <h2 className="text-base font-semibold text-foreground mb-3">Stops this session</h2>
        {stops.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stops yet. Start driving, then tap Log stop at each pickup/dropoff.</p>
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
                  <Button type="button" size="sm" variant="outline" className="border-border" onClick={() => handleEndStop(s.id)}>
                    End stop
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Tip: when Start driving is ON and you end the session, mileage + estimated fuel are written into{" "}
          <Link to="/tax-center" className="text-titan-cyan hover:underline">
            Tax Center
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
