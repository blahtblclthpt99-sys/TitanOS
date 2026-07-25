/**
 * Job Location client helpers + geocode refresh.
 */
export {
  emptyJobLocation,
  normalizeJobLocation,
  formatJobLocation,
  validateJobLocation,
  jobLocationFromCustomer,
  jobLocationFromDocument,
  haversineMiles,
  milesToKm,
  estimateDriveMinutes,
  computeTravelSummary,
} from "../../shared/jobLocation.js";

import { geocodePlace } from "@/lib/weatherApi";
import {
  normalizeJobLocation,
  validateJobLocation,
} from "../../shared/jobLocation.js";

/**
 * Validate address text and attempt geocode for map / travel.
 * Does not invent tax rates.
 */
export async function resolveJobLocation(raw) {
  const { ok, errors, location } = validateJobLocation(raw);
  if (!ok) return { ok: false, errors, location };

  const query = [location.address, location.city, location.state, location.zip]
    .filter(Boolean)
    .join(", ");

  if (!query) {
    return { ok: false, errors: ["Enter a Job Location."], location };
  }

  // Keep existing coords if user already provided them
  if (location.lat != null && location.lng != null) {
    return {
      ok: true,
      errors: [],
      location: { ...location, validated: true, formatted: query },
    };
  }

  try {
    const geo = await geocodePlace(query);
    if (geo?.lat != null && geo?.lon != null) {
      return {
        ok: true,
        errors: [],
        location: normalizeJobLocation({
          ...location,
          lat: geo.lat,
          lng: geo.lon,
          city: location.city || geo.name || "",
          validated: true,
          source: location.source === "manual" ? "geocode" : location.source,
          formatted: query,
        }),
      };
    }
  } catch {
    /* geocode optional */
  }

  return {
    ok: true,
    errors: [],
    location: { ...location, validated: Boolean(location.city || location.zip), formatted: query },
    warning: "Could not pin on map — tax can still resolve from city/state/ZIP.",
  };
}
