/** GPS geofence helpers for job check-in proof. */

export function haversineMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function jobSiteCoords(job = {}) {
  const lat = Number(job.site_lat ?? job.checkin_lat ?? job.lat ?? job.latitude);
  const lng = Number(job.site_lng ?? job.checkin_lng ?? job.lng ?? job.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || !lat || !lng) return null;
  return { lat, lng };
}

export function evaluateGeofence(job, position, radiusM) {
  const site = jobSiteCoords(job);
  if (!site || !position) {
    return { ok: null, meters: null, reason: site ? "no_gps" : "no_site_coords" };
  }
  const meters = Math.round(haversineMeters(site, position));
  const radius = Number(radiusM ?? job.geofence_m ?? 150) || 150;
  return {
    ok: meters <= radius,
    meters,
    radius,
    site,
    reason: meters <= radius ? "inside" : "outside",
  };
}

export function openStreetMapEmbed(lat, lng, zoom = 16) {
  const d = 0.008;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function googleMapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
