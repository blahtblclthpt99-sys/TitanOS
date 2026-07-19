import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

function haversineMiles(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestNeighbor(stops) {
  if (!stops.length) return { ordered: [], totalMiles: 0, legs: [], method: "empty" };
  const remaining = [...stops];
  let current = remaining.shift();
  const ordered = [current];
  const legs = [];
  let totalMiles = 0;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d =
        current.lat != null && remaining[i].lat != null
          ? haversineMiles(current, remaining[i])
          : 12;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    legs.push({ from: current.id || current.label, to: next.id || next.label, miles: Math.round(bestDist * 10) / 10 });
    totalMiles += bestDist;
    ordered.push(next);
    current = next;
  }
  return {
    ordered,
    totalMiles: Math.round(totalMiles * 10) / 10,
    legs,
    method: "nearest_neighbor",
  };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { stops = [] } = readJson(req);
    const normalized = (Array.isArray(stops) ? stops : [])
      .map((s, i) => ({
        id: s.id || `stop-${i}`,
        label: s.label || s.title || s.address || `Stop ${i + 1}`,
        lat: s.lat != null ? Number(s.lat) : null,
        lng: s.lng != null ? Number(s.lng) : null,
        address: s.address || "",
      }))
      .filter((s) => s.label || s.address);

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    const withCoords = normalized.filter((s) => s.lat != null && s.lng != null && !Number.isNaN(s.lat));

    if (mapboxToken && withCoords.length >= 2) {
      const coords = withCoords.map((s) => `${s.lng},${s.lat}`).join(";");
      const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}?access_token=${mapboxToken}&overview=false&source=first&destination=last&roundtrip=false`;
      const response = await fetch(url);
      const json = await response.json();
      if (response.ok && json.waypoints) {
        const order = [...json.waypoints]
          .map((wp, idx) => ({ ...withCoords[idx], waypoint_index: wp.waypoint_index }))
          .sort((a, b) => a.waypoint_index - b.waypoint_index);
        const meters = json.trips?.[0]?.distance || 0;
        return res.status(200).json({
          ordered: order,
          totalMiles: Math.round((meters / 1609.34) * 10) / 10,
          legs: order.slice(1).map((stop, i) => ({
            from: order[i].label,
            to: stop.label,
            miles: null,
          })),
          method: "mapbox_optimized_trips",
        });
      }
      console.error("Mapbox optimize fallback:", json);
    }

    return res.status(200).json(nearestNeighbor(normalized));
  } catch (error) {
    console.error("directionsOptimize error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
