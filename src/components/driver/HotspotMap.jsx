import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayPartLabel, getDayPart } from "@/lib/driverHubApi";

const DAY_PARTS = ["morning", "lunch", "afternoon", "dinner", "late"];

const ZOOM_PADS = [0.055, 0.04, 0.032, 0.024, 0.018];

/**
 * Premium hotspot map: street-level OSM, zoom, day-part preview, lit pins, legend.
 */
export default function HotspotMap({
  centerLat,
  centerLng,
  hotspots = [],
  mode = "driving",
  active = false,
  dayPartFilter = null,
  onDayPartFilter,
  focusId = null,
  onFocus,
}) {
  const livePart = getDayPart();
  const part = dayPartFilter || livePart;
  const [selected, setSelected] = useState(hotspots[0]?.id || null);
  const [zoom, setZoom] = useState(2);

  useEffect(() => {
    if (focusId) setSelected(focusId);
  }, [focusId]);

  useEffect(() => {
    if (!selected && hotspots[0]?.id) setSelected(hotspots[0].id);
  }, [hotspots, selected]);

  const pad = ZOOM_PADS[zoom] ?? 0.032;
  const bounds = useMemo(
    () => ({
      west: centerLng - pad,
      east: centerLng + pad,
      south: centerLat - pad * 0.82,
      north: centerLat + pad * 0.82,
    }),
    [centerLat, centerLng, pad]
  );

  const embedSrc = useMemo(() => {
    const { west, east, south, north } = bounds;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${centerLat}%2C${centerLng}`;
  }, [bounds, centerLat, centerLng]);

  const osmLink = `https://www.openstreetmap.org/?mlat=${centerLat}&mlon=${centerLng}#map=${13 + zoom}/${centerLat}/${centerLng}`;

  const toStyle = (lat, lng) => {
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * 100;
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * 100;
    return {
      left: `${Math.min(95, Math.max(5, x))}%`,
      top: `${Math.min(92, Math.max(8, y))}%`,
    };
  };

  const selectedSpot = hotspots.find((h) => h.id === selected) || hotspots[0];
  const topNow = hotspots.filter((h) => h.hotNow).slice(0, 4);
  const previewing = Boolean(dayPartFilter && dayPartFilter !== livePart);

  const pick = (id) => {
    setSelected(id);
    onFocus?.(id);
  };

  return (
    <div className="space-y-3">
      {/* Day-part preview chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-0.5 px-0.5">
        <button
          type="button"
          onClick={() => onDayPartFilter?.(null)}
          className={`flex-shrink-0 h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${
            !dayPartFilter
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          Live now
        </button>
        {DAY_PARTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onDayPartFilter?.(p)}
            className={`flex-shrink-0 h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors capitalize ${
              dayPartFilter === p
                ? "bg-amber-500/15 text-amber-300 border-amber-500/35"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {p === "afternoon" ? "Afternoon" : p === "late" ? "Late night" : p}
          </button>
        ))}
      </div>

      <div
        className={`relative rounded-2xl overflow-hidden border bg-muted aspect-[4/3] sm:aspect-[16/10] min-h-[300px] ${
          active ? "border-amber-500/50 shadow-[0_0_36px_rgba(245,158,11,0.25)]" : "border-border"
        }`}
      >
        <iframe
          title="Hotspot map"
          className="absolute inset-0 w-full h-full pointer-events-none"
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        <div
          className={`absolute inset-0 pointer-events-none transition-opacity ${
            active ? "bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/25" : "bg-slate-950/40"
          }`}
        />

        <div className="absolute inset-0">
          {hotspots.map((h) => {
            const pos = toStyle(h.lat, h.lng);
            const heat = h.heat ?? 0.5;
            const isSel = selected === h.id;
            const showLabel = h.hotNow || isSel;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => pick(h.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={{ ...pos, zIndex: isSel || h.hotNow ? 25 : 10 }}
                aria-label={`${h.name}. ${h.when}`}
              >
                <span
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none ${
                    active && h.hotNow ? "animate-pulse" : ""
                  }`}
                  style={{
                    width: `${32 + heat * 70}px`,
                    height: `${32 + heat * 70}px`,
                    background: h.color,
                    opacity: active ? (h.hotNow ? 0.38 : 0.16) : 0.1,
                    filter: "blur(9px)",
                    boxShadow: `0 0 ${16 + heat * 40}px ${h.color}`,
                  }}
                />
                <span
                  className={`relative z-10 flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform ${
                    isSel ? "h-5 w-5 scale-125 ring-2 ring-white/40" : h.hotNow ? "h-4 w-4" : "h-2.5 w-2.5"
                  }`}
                  style={{
                    background: h.color,
                    boxShadow: `0 0 ${h.hotNow ? 16 : 6}px ${h.color}`,
                  }}
                />
                {showLabel && (
                  <span className="absolute left-1/2 top-[18px] z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md pointer-events-none max-w-[110px] truncate">
                    {h.short || h.name}
                    {h.hotNow ? " · NOW" : ""}
                  </span>
                )}
              </button>
            );
          })}

          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
            style={toStyle(centerLat, centerLng)}
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary/45 animate-ping" />
              <span className="relative h-3.5 w-3.5 rounded-full bg-primary border-2 border-white shadow-[0_0_14px_rgba(0,199,217,0.9)]" />
            </span>
            <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-1 py-0.5 text-[9px] font-bold text-black">
              You
            </span>
          </div>
        </div>

        <div className="absolute left-2 top-2 z-30 max-w-[58%] rounded-xl bg-black/80 backdrop-blur-sm px-2.5 py-1.5 text-[10px] text-white/95 space-y-0.5 border border-white/10">
          <p className="font-bold uppercase tracking-wider">
            {mode === "riding" ? "Pickup heat" : "Driver heat"} · {hotspots.length} pins
          </p>
          <p className="text-white/70 normal-case tracking-normal">
            {previewing ? `Preview · ${dayPartLabel(part)}` : dayPartLabel(livePart)}
          </p>
        </div>

        {topNow.length > 0 && active && (
          <div className="absolute right-2 top-2 z-30 max-w-[42%] rounded-xl border border-amber-400/45 bg-black/85 backdrop-blur-sm px-2.5 py-1.5 text-[10px] text-amber-200">
            <p className="font-bold uppercase tracking-wider text-amber-300 mb-0.5">Go now</p>
            {topNow.slice(0, 3).map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => pick(h.id)}
                className="block w-full text-left truncate hover:text-white py-0.5"
              >
                → {h.short || h.name}
              </button>
            ))}
          </div>
        )}

        {/* Zoom + open maps */}
        <div className="absolute right-2 bottom-2 z-30 flex flex-col gap-1.5">
          <div className="flex overflow-hidden rounded-xl border border-white/15 bg-black/80 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0, z - 1))}
              className="h-9 w-9 inline-flex items-center justify-center text-white hover:bg-white/10"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(ZOOM_PADS.length - 1, z + 1))}
              className="h-9 w-9 inline-flex items-center justify-center text-white hover:bg-white/10 border-l border-white/15"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <a
            href={osmLink}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-2.5 inline-flex items-center justify-center gap-1 rounded-xl border border-white/15 bg-black/80 text-[10px] font-semibold text-white hover:bg-white/10"
          >
            Full map <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Heat legend */}
        <div className="absolute left-2 bottom-2 z-30 rounded-xl bg-black/80 backdrop-blur-sm px-2.5 py-1.5 text-[9px] text-white/80 border border-white/10">
          <p className="font-semibold text-white/90 mb-1">Heat</p>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/30" /> Cool
            <span className="h-2.5 w-8 rounded-full bg-gradient-to-r from-emerald-400/40 via-amber-400 to-red-500" />
            Hot
          </div>
        </div>
      </div>

      {selectedSpot && (
        <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 h-3.5 w-3.5 rounded-full flex-shrink-0"
              style={{ background: selectedSpot.color, boxShadow: `0 0 12px ${selectedSpot.color}` }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground">{selectedSpot.name}</p>
                {selectedSpot.hotNow && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Hot now
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-400/90 mt-1 font-medium">
                {selectedSpot.nowTip || selectedSpot.when}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{selectedSpot.tip}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-border h-8 text-xs"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${selectedSpot.lat},${selectedSpot.lng}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  Navigate here
                </Button>
                <span className="text-[11px] text-muted-foreground self-center">
                  Demand ~{Math.round((selectedSpot.heat || 0) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
