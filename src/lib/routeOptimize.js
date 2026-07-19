/**
 * Route optimization for a day's jobs.
 * Uses nearest-neighbor heuristic on lat/lng when present, else address string clustering.
 * Ready to swap for a Mapbox/Google Directions API later via optimizeWithProvider().
 */

function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function jobPoint(job) {
  const lat = Number(job.checkin_lat ?? job.lat ?? job.latitude);
  const lng = Number(job.checkin_lng ?? job.lng ?? job.longitude);
  if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat && lng) {
    return { lat, lng, hasCoords: true };
  }
  return {
    lat: null,
    lng: null,
    hasCoords: false,
    key: `${job.city || ""}|${job.state || ""}|${job.address || job.customer_name || job.title || ""}`.toLowerCase(),
  };
}

function distance(aJob, bJob) {
  const a = jobPoint(aJob);
  const b = jobPoint(bJob);
  if (a.hasCoords && b.hasCoords) return haversine(a, b);
  if (a.key && b.key && a.key === b.key) return 0.5;
  if (a.key && b.key) {
    // crude string distance proxy
    const sameCity = (aJob.city || "").toLowerCase() === (bJob.city || "").toLowerCase();
    const sameState = (aJob.state || "").toLowerCase() === (bJob.state || "").toLowerCase();
    if (sameCity && sameState) return 3;
    if (sameState) return 25;
    return 80;
  }
  return 40;
}

/** Nearest-neighbor TSP starting from optional start job or first. */
export function optimizeJobRoute(jobs = [], { startId = null } = {}) {
  if (!jobs.length) return { ordered: [], totalMiles: 0, legs: [] };

  const remaining = [...jobs];
  let current;
  if (startId) {
    const idx = remaining.findIndex((j) => j.id === startId);
    current = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.shift();
  } else {
    current = remaining.shift();
  }

  const ordered = [current];
  const legs = [];
  let totalMiles = 0;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distance(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    legs.push({
      from: current.title || current.customer_name || "Stop",
      to: next.title || next.customer_name || "Stop",
      miles: Math.round(bestDist * 10) / 10,
    });
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

export function mapsDirectionsUrl(orderedJobs = []) {
  if (!orderedJobs.length) return "";
  const q = orderedJobs
    .map((j) => encodeURIComponent(j.address || `${j.city || ""} ${j.state || ""}`.trim() || j.title || ""))
    .filter(Boolean);
  if (q.length < 2) return `https://www.google.com/maps/search/?api=1&query=${q[0] || ""}`;
  const origin = q[0];
  const destination = q[q.length - 1];
  const waypoints = q.slice(1, -1).join("%7C");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
    waypoints ? `&waypoints=${waypoints}` : ""
  }`;
}

/** Prefer Mapbox Optimized Trips API (server) when available; else nearest-neighbor. */
export async function optimizeWithProvider(jobs = [], { startId = null } = {}) {
  const local = optimizeJobRoute(jobs, { startId });
  try {
    const { api } = await import("@/api/apiClient");
    const stops = jobs.map((j) => ({
      id: j.id,
      label: j.title || j.customer_name || "Stop",
      address: j.address || `${j.city || ""} ${j.state || ""}`.trim(),
      lat: j.site_lat ?? j.checkin_lat ?? j.lat ?? j.latitude,
      lng: j.site_lng ?? j.checkin_lng ?? j.lng ?? j.longitude,
    }));
    const res = await api.functions.invoke("directionsOptimize", { stops });
    const data = res?.data || res;
    if (!data?.ordered?.length) return local;
    const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));
    const ordered = data.ordered.map((s) => byId[s.id] || s).filter(Boolean);
    if (ordered.length < 2) return local;
    return {
      ordered,
      totalMiles: data.totalMiles ?? local.totalMiles,
      legs: data.legs || local.legs,
      method: data.method || "provider",
    };
  } catch {
    return local;
  }
}
