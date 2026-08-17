function finiteCoordinate(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const aLat = finiteCoordinate(lat1, -90, 90);
  const aLng = finiteCoordinate(lng1, -180, 180);
  const bLat = finiteCoordinate(lat2, -90, 90);
  const bLng = finiteCoordinate(lng2, -180, 180);
  if ([aLat, aLng, bLat, bLng].some((value) => value == null)) return null;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

export function applyRadiusToMatch(job, profile = {}) {
  if (!job || String(job.work_mode || "").toLowerCase() === "remote") return { ...job, distance_mi: null, within_radius: true };
  const distance = haversineMiles(profile.lat, profile.lng, job.lat, job.lng);
  if (distance == null) return { ...job, distance_mi: null, within_radius: null };
  const radius = Math.min(500, Math.max(1, Number(profile.work_radius_miles || 50) || 50));
  return { ...job, distance_mi: distance, within_radius: distance <= radius };
}

export function filterByRadius(jobs = [], profile = {}) {
  return (jobs || [])
    .map((job) => applyRadiusToMatch(job, profile))
    .filter((job) => job.within_radius !== false);
}
