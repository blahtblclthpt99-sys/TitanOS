export function finiteJobCoordinate(value, min, max) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function normalizeJobCoordinates(job = {}) {
  return {
    lat: finiteJobCoordinate(job.lat ?? job.latitude, -90, 90),
    lng: finiteJobCoordinate(job.lng ?? job.longitude, -180, 180),
  };
}
