/**
 * Job Location — service / delivery situs (pure helpers).
 * Separate from Driver Location. Used for tax, routing, travel, availability.
 */

export function emptyJobLocation(partial = {}) {
  return {
    address: "",
    city: "",
    state: "",
    county: "",
    zip: "",
    country: "US",
    lat: null,
    lng: null,
    formatted: "",
    source: "manual", // manual | customer | job | geocode
    validated: false,
    ...partial,
  };
}

export function normalizeJobLocation(raw) {
  if (!raw || typeof raw !== "object") return emptyJobLocation();
  const lat = raw.lat != null && raw.lat !== "" ? Number(raw.lat) : null;
  const lng = raw.lng != null && raw.lng !== "" ? Number(raw.lng) : null;
  const loc = emptyJobLocation({
    address: String(raw.address || "").trim().slice(0, 300),
    city: String(raw.city || "").trim().slice(0, 100),
    state: String(raw.state || "").trim().slice(0, 40),
    county: String(raw.county || "").trim().slice(0, 100),
    zip: String(raw.zip || raw.postalCode || "").trim().slice(0, 20),
    country: String(raw.country || "US").trim().toUpperCase().slice(0, 2) || "US",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    source: String(raw.source || "manual"),
    validated: Boolean(raw.validated),
  });
  loc.formatted = formatJobLocation(loc);
  return loc;
}

export function formatJobLocation(loc) {
  if (!loc) return "";
  const line1 = loc.address || "";
  const line2 = [loc.city, loc.state, loc.zip].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(" · ");
}

/**
 * Minimal validation — enough to resolve tax / travel.
 */
export function validateJobLocation(raw) {
  const loc = normalizeJobLocation(raw);
  const errors = [];
  if (!loc.city && !loc.zip && !loc.address) {
    errors.push("Enter a job address, city, or ZIP.");
  }
  if (loc.lat != null && (loc.lat < -90 || loc.lat > 90)) errors.push("Latitude is invalid.");
  if (loc.lng != null && (loc.lng < -180 || loc.lng > 180)) errors.push("Longitude is invalid.");
  if (loc.zip && !/[\dA-Za-z]/.test(loc.zip)) errors.push("ZIP / postal code looks invalid.");
  return { ok: errors.length === 0, errors, location: loc };
}

/** Build Job Location from a customer record (never from driver prefs). */
export function jobLocationFromCustomer(customer) {
  if (!customer) return emptyJobLocation({ source: "customer" });
  return normalizeJobLocation({
    address: customer.address || "",
    city: customer.city || "",
    state: customer.state || "",
    zip: customer.zip || "",
    country: customer.country || "US",
    source: "customer",
  });
}

/** Build Job Location from a job / estimate document. */
export function jobLocationFromDocument(doc) {
  if (!doc) return emptyJobLocation();
  if (doc.job_location && typeof doc.job_location === "object") {
    return normalizeJobLocation({ ...doc.job_location, source: doc.job_location.source || "job" });
  }
  return normalizeJobLocation({
    address: doc.address || doc.job_address || "",
    city: doc.job_city || doc.city || "",
    state: doc.job_state || doc.state || "",
    county: doc.job_county || doc.county || "",
    zip: doc.job_zip || doc.zip || "",
    country: doc.job_country || doc.country || "US",
    lat: doc.site_lat ?? doc.job_lat ?? doc.lat ?? null,
    lng: doc.site_lng ?? doc.job_lng ?? doc.lng ?? null,
    source: "job",
  });
}

export function haversineMiles(a, b) {
  if (
    !a ||
    !b ||
    a.lat == null ||
    a.lng == null ||
    b.lat == null ||
    b.lng == null ||
    !Number.isFinite(Number(a.lat)) ||
    !Number.isFinite(Number(a.lng)) ||
    !Number.isFinite(Number(b.lat)) ||
    !Number.isFinite(Number(b.lng))
  ) {
    return null;
  }
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export function milesToKm(miles) {
  if (miles == null || !Number.isFinite(Number(miles))) return null;
  return Math.round(Number(miles) * 1.60934 * 10) / 10;
}

/** Rough drive-time estimate (~25 mph urban average). */
export function estimateDriveMinutes(miles, { avgMph = 25 } = {}) {
  if (miles == null || !Number.isFinite(Number(miles)) || Number(miles) < 0) return null;
  const mph = Number(avgMph) > 0 ? Number(avgMph) : 25;
  return Math.max(1, Math.round((Number(miles) / mph) * 60));
}

/**
 * Travel summary between Driver Location (origin) and Job Location (destination).
 * Does not affect tax.
 */
export function computeTravelSummary(driverLocation, jobLocation, { distanceUnits = "mi" } = {}) {
  const miles = haversineMiles(driverLocation, jobLocation);
  if (miles == null) {
    return {
      ready: false,
      miles: null,
      distanceLabel: null,
      driveMinutes: null,
      withinRadius: null,
      message: "Add coordinates on Driver Location and Job Location to estimate travel.",
    };
  }
  const driveMinutes = estimateDriveMinutes(miles);
  const useKm = distanceUnits === "km";
  const distanceLabel = useKm ? `${milesToKm(miles)} km` : `${miles} mi`;
  const maxR = driverLocation?.maxServiceRadiusMi;
  const withinRadius =
    maxR != null && Number.isFinite(Number(maxR)) ? miles <= Number(maxR) : null;

  return {
    ready: true,
    miles,
    km: milesToKm(miles),
    distanceLabel,
    driveMinutes,
    withinRadius,
    message:
      withinRadius === false
        ? `Job is outside your max service radius (${maxR} mi).`
        : `About ${distanceLabel} · ~${driveMinutes} min drive (estimate).`,
  };
}
