import React, { useMemo, useState } from "react";
import { dayPartLabel, getDayPart } from "@/lib/driverHubApi";

/**
 * Detailed OSM map + many glowing timed hotspot pins.
 * Closer zoom for street detail; labels + “best now” callouts.
 */
export default function HotspotMap({
  centerLat,
  centerLng,
  hotspots = [],
  mode = "driving",
  active = false,
}) {
  const [selected, setSelected] = useState(hotspots[0]?.id || null);
  const part = getDayPart();
  // Tighter bbox = more street-level detail on the embed
  const pad = 0.032;
  const bounds = useMemo(
    () => ({
      west: centerLng - pad,
      east: centerLng + pad,
      south: centerLat - pad * 0.85,
      north: centerLat + pad * 0.85,
    }),
    [centerLat, centerLng]
  );

  const embedSrc = useMemo(() => {
    const { west, east, south, north } = bounds;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${centerLat}%2C${centerLng}`;
  }, [bounds, centerLat, centerLng]);

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

  return (
    <div className="space-y-3">
      <div
        className={`relative rounded-xl overflow-hidden border bg-muted aspect-[4/3] sm:aspect-[16/10] min-h-[280px] ${
          active ? "border-amber-500/50 shadow-[0_0_32px_rgba(245,158,11,0.22)]" : "border-border"
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
            active ? "bg-slate-950/20" : "bg-slate-950/35"
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
                onClick={() => setSelected(h.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
                style={{ ...pos, zIndex: isSel || h.hotNow ? 20 : 10 }}
                aria-label={`${h.name}. ${h.when}`}
              >
                <span
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none ${
                    active && h.hotNow ? "animate-pulse" : ""
                  }`}
                  style={{
                    width: `${36 + heat * 64}px`,
                    height: `${36 + heat * 64}px`,
                    background: h.color,
                    opacity: active ? (h.hotNow ? 0.35 : 0.18) : 0.12,
                    filter: "blur(8px)",
                    boxShadow: `0 0 ${18 + heat * 36}px ${h.color}`,
                  }}
                />
                <span
                  className={`relative z-10 flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform ${
                    isSel ? "h-5 w-5 scale-125" : h.hotNow ? "h-4 w-4" : "h-3 w-3"
                  }`}
                  style={{
                    background: h.color,
                    boxShadow: `0 0 ${h.hotNow ? 14 : 8}px ${h.color}`,
                  }}
                />
                {showLabel && (
                  <span className="absolute left-1/2 top-[18px] z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md pointer-events-none">
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
              <span className="absolute inset-0 rounded-full bg-titan-cyan/40 animate-ping" />
              <span className="relative h-3.5 w-3.5 rounded-full bg-titan-cyan border-2 border-white shadow-[0_0_14px_rgba(0,199,217,0.9)]" />
            </span>
            <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded bg-titan-cyan/90 px-1 py-0.5 text-[9px] font-bold text-black">
              You
            </span>
          </div>
        </div>

        <div className="absolute left-2 top-2 z-30 max-w-[70%] rounded-lg bg-black/75 px-2 py-1.5 text-[10px] text-white/95 space-y-0.5">
          <p className="font-bold uppercase tracking-wider">
            {mode === "riding" ? "Pickup heat" : "Driver heat"} · {hotspots.length} zones
          </p>
          <p className="text-white/70 normal-case tracking-normal">{dayPartLabel(part)}</p>
        </div>

        {topNow.length > 0 && active && (
          <div className="absolute right-2 top-2 z-30 max-w-[45%] rounded-lg border border-amber-400/40 bg-black/80 px-2 py-1.5 text-[10px] text-amber-200">
            <p className="font-bold uppercase tracking-wider text-amber-300">Go now</p>
            {topNow.slice(0, 3).map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelected(h.id)}
                className="block w-full text-left truncate hover:text-white"
              >
                → {h.short || h.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSpot && (
        <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm">
          <div className="flex items-start gap-2">
            <span
              className="mt-1 h-3 w-3 rounded-full flex-shrink-0"
              style={{ background: selectedSpot.color, boxShadow: `0 0 8px ${selectedSpot.color}` }}
            />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{selectedSpot.name}</p>
              <p className="text-xs text-amber-400/90 mt-0.5">{selectedSpot.nowTip || selectedSpot.when}</p>
              <p className="text-xs text-muted-foreground mt-1">{selectedSpot.tip}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
