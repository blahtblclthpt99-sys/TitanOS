/**
 * Driver directory filters/sort + live list helpers.
 * Profiles come from driverProfilesApi (Supabase) — no fake seed people.
 */
import {
  getDriverProfileById,
  listPublishedDrivers,
} from "@/lib/driverProfilesApi";

export const LICENSE_FILTERS = [
  { id: "cdl", label: "CDL" },
  { id: "non_cdl", label: "Non-CDL" },
];

export const VEHICLE_FILTERS = [
  { id: "box_truck", label: "Box Truck" },
  { id: "cargo_van", label: "Cargo Van" },
  { id: "pickup", label: "Pickup" },
  { id: "flatbed", label: "Flatbed" },
];

export const ROUTE_FILTERS = [
  { id: "local", label: "Local" },
  { id: "regional", label: "Regional" },
  { id: "otr", label: "OTR" },
];

export const AVAILABILITY_FILTERS = [
  { id: "any", label: "Any" },
  { id: "available", label: "Available now" },
  { id: "busy", label: "On a job" },
  { id: "offline", label: "Offline" },
];

export const DISTANCE_FILTERS = [
  { id: null, label: "Any distance" },
  { id: 5, label: "Within 5 mi" },
  { id: 15, label: "Within 15 mi" },
  { id: 30, label: "Within 30 mi" },
  { id: 50, label: "Within 50 mi" },
];

export const RATING_FILTERS = [
  { id: 0, label: "Any rating" },
  { id: 4, label: "4.0+" },
  { id: 4.5, label: "4.5+" },
  { id: 4.8, label: "4.8+" },
];

export const SORT_OPTIONS = [
  { id: "rating", label: "Highest rated" },
  { id: "distance", label: "Closest" },
  { id: "response", label: "Fastest response" },
  { id: "jobs", label: "Most jobs" },
  { id: "rate_low", label: "Lowest rate" },
  { id: "rate_high", label: "Highest rate" },
  { id: "newest", label: "Newest" },
  { id: "verified", label: "Verified first" },
];

export const COLLECTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "favorites", label: "Favorites" },
  { id: "saved", label: "Saved" },
];

export const TRUST_FILTERS = [
  { id: "any", label: "Any trust" },
  { id: "verified", label: "ID verified" },
  { id: "insured", label: "Insured" },
  { id: "background", label: "Background check" },
  { id: "titan", label: "Titan Verified" },
];

const CDL_TAGS = new Set(["cdl_class_a", "cdl_class_b", "cdl"]);

let _cache = [];

function driverMatchesLicense(driver, licenseIds = []) {
  if (!licenseIds.length) return true;
  const tags = new Set(driver.vehicleTags || []);
  return licenseIds.some((id) => {
    if (id === "cdl") return [...CDL_TAGS].some((t) => tags.has(t));
    return tags.has(id);
  });
}

function driverMatchesAnyTag(driver, ids = [], field = "vehicleTags") {
  if (!ids.length) return true;
  const tags = new Set(driver[field] || []);
  return ids.some((id) => tags.has(id));
}

/** @deprecated Prefer listDriversAsync — sync cache may be empty until refresh. */
export function listDrivers() {
  return _cache.slice();
}

export async function listDriversAsync(viewer = null) {
  const rows = await listPublishedDrivers({
    viewerLat: viewer?.lat ?? null,
    viewerLng: viewer?.lng ?? null,
  });
  _cache = rows;
  return rows;
}

export function getDriverById(id) {
  if (!id) return null;
  return _cache.find((d) => d.id === id) || null;
}

export async function getDriverByIdAsync(id, viewer = null) {
  if (!id) return null;
  const cached = getDriverById(id);
  if (cached) return cached;
  return getDriverProfileById(id, viewer);
}

/** Normalize legacy shapes (no fabricated reviews). */
export function normalizeDriver(raw = {}) {
  return {
    id: raw.id,
    photo: raw.photo || "",
    name: raw.name || "Driver",
    rating: Number(raw.rating) || 0,
    reviewCount: Number(raw.reviewCount) || 0,
    verified: Boolean(raw.verified),
    insured: Boolean(raw.insured),
    backgroundChecked: Boolean(raw.backgroundChecked),
    verificationStatus: raw.verificationStatus || (raw.verified ? "verified" : "unverified"),
    licenseClass: raw.licenseClass || raw.licenseType || "Non-CDL",
    licenseType: raw.licenseClass || raw.licenseType || "Non-CDL",
    vehicleType: raw.vehicleType || "Vehicle",
    vehicleTags: raw.vehicleTags || [],
    vehicleMake: raw.vehicleMake || "",
    vehicleModel: raw.vehicleModel || "",
    vehicleYear: raw.vehicleYear ? Number(raw.vehicleYear) : null,
    vehicleCapacityLbs: raw.vehicleCapacityLbs != null ? Number(raw.vehicleCapacityLbs) : null,
    vehicleLengthFt: raw.vehicleLengthFt != null ? Number(raw.vehicleLengthFt) : null,
    vehicleCapacity: raw.vehicleCapacity || null,
    yearsExperience: Number(raw.yearsExperience) || 0,
    city: raw.city || "",
    location: raw.city || raw.location || "",
    distanceMi: Number(raw.distanceMi) || 0,
    availability: raw.availability || "offline",
    completedJobs: Number(raw.completedJobs) || 0,
    responseTimeMin: Number(raw.responseTimeMin) || 0,
    skills: raw.skills || [],
    certifications: raw.certifications || [],
    routes: raw.routes || [],
    bio: raw.bio || "",
    rateHourly: Number(raw.rateHourly) || 0,
    rateUnit: raw.rateUnit || "hour",
    joinedAt: raw.joinedAt || "",
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    published: Boolean(raw.published),
    userId: raw.userId || raw.user_id || null,
  };
}

export function verificationStatusLabel(status) {
  return (
    { verified: "Verified", pending: "Pending review", unverified: "Unverified" }[status] ||
    "Unverified"
  );
}

export function verificationStatusClass(status) {
  return (
    {
      verified: "bg-success/15 text-success",
      pending: "bg-warning/15 text-warning",
      unverified: "bg-muted text-muted-foreground",
    }[status] || "bg-muted text-muted-foreground"
  );
}

export function formatDriverRate(driver) {
  const n = Number(driver?.rateHourly);
  if (!Number.isFinite(n) || n <= 0) return "Rate on request";
  return `$${Math.round(n)}/hr`;
}

export function formatVehicleSummary(driver) {
  if (!driver) return "Vehicle";
  const id = driver.vehicleCapacity?.identity;
  const parts = [
    id?.year || driver.vehicleYear,
    id?.make || driver.vehicleMake,
    id?.model || driver.vehicleModel,
    id?.trim,
  ].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return id?.vehicleType || driver.vehicleType || "Vehicle";
}

export function formatVehicleSpecs(driver) {
  if (!driver) return [];
  const specs = [];
  const cap = driver.vehicleCapacity;
  const type = cap?.identity?.vehicleType || driver.vehicleType;
  if (type) specs.push({ label: "Type", value: type });
  const lengthFt =
    driver.vehicleLengthFt ||
    (cap?.dimensions?.cargoLengthIn != null
      ? Math.round((cap.dimensions.cargoLengthIn / 12) * 10) / 10
      : null);
  if (lengthFt) specs.push({ label: "Length", value: `${lengthFt} ft` });
  const payload =
    driver.vehicleCapacityLbs ||
    cap?.weight?.maxPayloadLb ||
    cap?.weight?.recommendedWorkingPayloadLb;
  if (payload) {
    specs.push({
      label: "Capacity",
      value:
        payload >= 1000 ? `${Math.round(payload / 1000)}k lbs` : `${Math.round(payload)} lbs`,
    });
  }
  if (driver.licenseClass) specs.push({ label: "License", value: driver.licenseClass });
  return specs;
}

export function editDistance(a = "", b = "") {
  const s = String(a).toLowerCase();
  const t = String(b).toLowerCase();
  if (!s) return t.length;
  if (!t) return s.length;
  const m = Array.from({ length: s.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= t.length; j++) m[0][j] = j;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[s.length][t.length];
}

export function fuzzyMatch(haystack, needle) {
  const h = String(haystack || "").toLowerCase();
  const n = String(needle || "").toLowerCase().trim();
  if (!n) return true;
  if (h.includes(n)) return true;
  const words = h.split(/[^a-z0-9]+/).filter(Boolean);
  const maxDist = n.length <= 4 ? 1 : 2;
  return words.some((w) => {
    if (w.startsWith(n) || n.startsWith(w)) return true;
    // Levenshtein distance cannot be within the threshold when lengths differ
    // by more than the threshold. Avoid allocating a matrix for obvious misses.
    if (Math.abs(w.length - n.length) > maxDist) return false;
    return editDistance(w, n) <= maxDist;
  });
}

export function filterDrivers(
  drivers,
  {
    query = "",
    filters = {},
    availability = "any",
    minRating = 0,
    maxDistance = null,
    trust = "any",
    collectionIds = null,
  } = {}
) {
  const license = filters.license || [];
  const vehicle = filters.vehicle || [];
  const route = filters.route || [];
  const idSet =
    collectionIds instanceof Set ? collectionIds : collectionIds ? new Set(collectionIds) : null;

  return (drivers || []).filter((d) => {
    if (idSet && !idSet.has(d.id)) return false;
    if (availability !== "any" && d.availability !== availability) return false;
    if (minRating > 0 && d.rating < minRating) return false;
    if (maxDistance != null && d.distanceMi > maxDistance) return false;
    if (trust === "verified" && !d.verified) return false;
    if (trust === "insured" && !d.insured) return false;
    if (trust === "background" && !d.backgroundChecked) return false;
    if (trust === "titan" && !(d.verified && d.insured && d.backgroundChecked && d.rating >= 4.5)) {
      return false;
    }
    if (!driverMatchesLicense(d, license)) return false;
    if (!driverMatchesAnyTag(d, vehicle, "vehicleTags")) return false;
    if (!driverMatchesAnyTag(d, route, "routes")) return false;
    if (query.trim()) {
      const blob = [
        d.name,
        d.vehicleType,
        d.vehicleMake,
        d.vehicleModel,
        d.licenseClass,
        d.city,
        ...(d.skills || []),
        ...(d.certifications || []),
        ...(d.vehicleTags || []),
        ...(d.routes || []),
      ].join(" ");
      if (!fuzzyMatch(blob, query)) return false;
    }
    return true;
  });
}

export function sortDrivers(drivers, sortBy = "rating") {
  const rows = [...(drivers || [])];
  const trustRank = (d) =>
    (d.verified ? 4 : 0) + (d.insured ? 2 : 0) + (d.backgroundChecked ? 1 : 0);

  switch (sortBy) {
    case "distance":
      return rows.sort((a, b) => a.distanceMi - b.distanceMi);
    case "newest":
      return rows.sort((a, b) => String(b.joinedAt).localeCompare(String(a.joinedAt)));
    case "jobs":
      return rows.sort((a, b) => b.completedJobs - a.completedJobs);
    case "response":
      return rows.sort((a, b) => a.responseTimeMin - b.responseTimeMin);
    case "rate_low":
      return rows.sort((a, b) => (a.rateHourly || 9999) - (b.rateHourly || 9999));
    case "rate_high":
      return rows.sort((a, b) => (b.rateHourly || 0) - (a.rateHourly || 0));
    case "verified":
      return rows.sort(
        (a, b) => trustRank(b) - trustRank(a) || b.rating - a.rating || b.reviewCount - a.reviewCount
      );
    case "rating":
    default:
      return rows.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  }
}

export function availabilityLabel(status) {
  return (
    { available: "Available now", busy: "On a job", offline: "Offline" }[status] || status
  );
}

export function availabilityDotClass(status) {
  return (
    {
      available: "bg-success",
      busy: "bg-warning",
      offline: "bg-muted-foreground/50",
    }[status] || "bg-muted-foreground/50"
  );
}

export function availabilityClass(status) {
  return (
    {
      available: "bg-success/15 text-success",
      busy: "bg-warning/15 text-warning",
      offline: "bg-muted text-muted-foreground",
    }[status] || "bg-muted text-muted-foreground"
  );
}
