import React, { useMemo, useState } from "react";

/**
 * OSM embed + glowing hotspot overlays projected into the map bbox.
 * Markers pulse so demand zones literally "light up" on the map.
 */
export default function HotspotMap({
  centerLat,
  centerLng,
  hotspots = [],
  mode = "driving",
  active = false,
}) {
  const [selected, setSelected] = useState(null);
  const pad = 0.045;
  const bounds = useMemo(
    () => ({
      west: centerLng - pad,
      east: centerLng + pad,
      south: centerLat - pad,
      north: centerLat + pad,
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
      left: `${Math.min(96, Math.max(4, x))}%`,
      top: `${Math.min(96, Math.max(4, y))}%`,
    };
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative rounded-xl overflow-hidden border bg-muted aspect-[16/10] ${
          active ? "border-amber-500/50 shadow-[0_0_28px_rgba(245,158,11,0.18)]" : "border-border"
        }`}
      >
        <iframe
          title="Hotspot map"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-90"
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* Dim overlay so glow markers pop */}
        <div className="absolute inset-0 bg-slate-950/25 pointer-events-none" />

        {/* Interactive hotspot layer */}
        <div className="absolute inset-0">
          {hotspots.map((h, i) => {
            const pos = toStyle(h.lat, h.lng);
            const heat = h.heat ?? 0.55 + (i % 3) * 0.12;
            const isSel = selected === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelected(isSel ? null : h.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={pos}
                aria-label={h.name}
              >
                {/* Heat bloom */}
                <span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse pointer-events-none"
                  style={{
                    width: `${48 + heat * 56}px`,
                    height: `${48 + heat * 56}px`,
                    background: h.color,
                    opacity: active ? 0.28 : 0.16,
                    filter: "blur(10px)",
                    boxShadow: `0 0 ${24 + heat * 30}px ${h.color}`,
                  }}
                />
                {/* Core pin */}
                <span
                  className={`relative z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform ${
                    isSel ? "scale-125" : "group-hover:scale-110"
                  }`}
                  style={{
                    background: h.color,
                    boxShadow: `0 0 12px ${h.color}`,
                  }}
                />
                <span className="absolute left-1/2 top-5 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {h.name}
                </span>
              </button>
            );
          })}

          {/* You-are-here */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
            style={toStyle(centerLat, centerLng)}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-titan-cyan border-2 border-white shadow-[0_0_12px_rgba(0,199,217,0.8)]" />
          </div>
        </div>

        <div className="absolute left-2 top-2 z-30 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90">
          {mode === "riding" ? "Pickup heat" : "Driver heat"} · lit zones
        </div>
      </div>

      {selected && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {hotspots.find((h) => h.id === selected)?.name}:{" "}
          </span>
          {hotspots.find((h) => h.id === selected)?.tip}
        </p>
      )}
    </div>
  );
}
