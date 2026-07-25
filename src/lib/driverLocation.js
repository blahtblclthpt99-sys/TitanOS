/**
 * Driver Location — personalization only (NOT tax situs).
 *
 * Used for: map center, nearby jobs, service radius, timezone, units,
 * regional formatting, weather, notifications, dashboard defaults.
 *
 * Changing Driver Location must never change sales tax on estimates.
 */

import { readPrefs, savePrefs } from "@/lib/driverHubApi";

export const DRIVER_LOCATION_HELP =
  "Your Driver Location personalizes maps, weather, and nearby suggestions. It does not set sales tax — Job Location does.";

export function emptyDriverLocation(partial = {}) {
  return {
    homeAddress: "",
    homeCity: "",
    homeState: "",
    homeZip: "",
    lat: null,
    lng: null,
    preferredServiceArea: "",
    maxServiceRadiusMi: 50,
    distanceUnits: "mi", // mi | km
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
    currency: "USD",
    locale: "en-US",
    ...partial,
  };
}

export function normalizeDriverLocation(raw) {
  const base = emptyDriverLocation(typeof raw === "object" && raw ? raw : {});
  const lat = raw?.lat != null && raw.lat !== "" ? Number(raw.lat) : null;
  const lng = raw?.lng != null && raw.lng !== "" ? Number(raw.lng) : null;
  const radius = raw?.maxServiceRadiusMi != null ? Number(raw.maxServiceRadiusMi) : 50;
  return {
    ...base,
    homeAddress: String(base.homeAddress || "").trim().slice(0, 300),
    homeCity: String(base.homeCity || raw?.city || "").trim().slice(0, 100),
    homeState: String(base.homeState || "").trim().slice(0, 40),
    homeZip: String(base.homeZip || raw?.zip || "").trim().slice(0, 20),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    preferredServiceArea: String(base.preferredServiceArea || "").trim().slice(0, 200),
    maxServiceRadiusMi:
      Number.isFinite(radius) && radius >= 0 && radius <= 2000 ? radius : 50,
    distanceUnits: base.distanceUnits === "km" ? "km" : "mi",
    timeZone: String(base.timeZone || "America/Chicago").slice(0, 64),
    currency: String(base.currency || "USD").toUpperCase().slice(0, 3),
    locale: String(base.locale || "en-US").slice(0, 16),
  };
}

/**
 * Merge legacy prefs (city/zip/lat/lng/currency) into Driver Location shape.
 */
export function driverLocationFromPrefs(prefs) {
  const p = prefs || {};
  return normalizeDriverLocation({
    homeAddress: p.homeAddress || "",
    homeCity: p.homeCity || p.city || "",
    homeState: p.homeState || "",
    homeZip: p.homeZip || p.zip || "",
    lat: p.lat,
    lng: p.lng,
    preferredServiceArea: p.preferredServiceArea || "",
    maxServiceRadiusMi: p.maxServiceRadiusMi,
    distanceUnits: p.distanceUnits,
    timeZone: p.timeZone,
    currency: p.currency,
    locale: p.locale,
  });
}

/** Persist Driver Location into driver prefs without touching tax. */
export function readDriverLocation(userId) {
  return driverLocationFromPrefs(readPrefs(userId));
}

export function saveDriverLocation(userId, locationPatch) {
  const current = readPrefs(userId);
  const nextLoc = normalizeDriverLocation({
    ...driverLocationFromPrefs(current),
    ...locationPatch,
  });
  // Keep legacy keys in sync for weather / hotspot map / gas ZIP
  return savePrefs(userId, {
    ...current,
    ...nextLoc,
    city: nextLoc.homeCity,
    zip: nextLoc.homeZip,
    lat: nextLoc.lat,
    lng: nextLoc.lng,
    currency: nextLoc.currency,
  });
}

export function formatDriverLocationLabel(loc) {
  const n = normalizeDriverLocation(loc);
  const parts = [n.homeCity, n.homeState, n.homeZip].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (n.homeAddress) return n.homeAddress;
  return "Driver location not set";
}
