/**
 * Driver directory — browse verified drivers with filters & sort.
 * Seeded local data until a backend driver_profiles table exists.
 */

const SEED_KEY = "titanos_driver_directory_v4";

/** License type chips */
export const LICENSE_FILTERS = [
  { id: "cdl", label: "CDL" },
  { id: "non_cdl", label: "Non-CDL" },
];

/** Vehicle type chips */
export const VEHICLE_FILTERS = [
  { id: "box_truck", label: "Box Truck" },
  { id: "cargo_van", label: "Cargo Van" },
  { id: "pickup", label: "Pickup" },
  { id: "flatbed", label: "Flatbed" },
];

/** Route / haul type chips */
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

/** Quick collection tabs in the directory */
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

/** Tags that satisfy the combined "CDL" license filter */
const CDL_TAGS = new Set(["cdl_class_a", "cdl_class_b", "cdl"]);

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

const SEED_DRIVERS = [
  {
    id: "d1",
    name: "Marcus Rivera",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    verified: true,
    rating: 4.9,
    reviewCount: 128,
    vehicleType: "Box Truck",
    vehicleTags: ["box_truck", "cdl_class_b", "owner_operator"],
    licenseClass: "CDL Class B",
    yearsExperience: 8,
    availability: "available",
    distanceMi: 3.2,
    responseTimeMin: 4,
    completedJobs: 642,
    skills: ["Residential delivery", "Furniture", "Liftgate"],
    certifications: ["DOT Medical", "TWIC"],
    routes: ["local", "regional"],
    city: "Dallas, TX",
    joinedAt: "2024-02-12",
    bio: "Reliable local & regional box truck operator.",
    rateHourly: 65,
    rateUnit: "hour",
    insured: true,
    backgroundChecked: true,
    vehicleMake: "Isuzu",
    vehicleModel: "NPR",
    vehicleYear: 2021,
    vehicleCapacityLbs: 10000,
    vehicleLengthFt: 16,
  },
  {
    id: "d2",
    name: "Aisha Thompson",
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    verified: true,
    rating: 4.8,
    reviewCount: 94,
    vehicleType: "Cargo Van",
    vehicleTags: ["cargo_van", "non_cdl"],
    licenseClass: "Non-CDL",
    yearsExperience: 5,
    availability: "available",
    distanceMi: 1.8,
    responseTimeMin: 2,
    completedJobs: 411,
    skills: ["Same-day", "Amazon Flex style", "Amazon returns"],
    certifications: ["Background check"],
    routes: ["local"],
    city: "Dallas, TX",
    joinedAt: "2024-08-01",
    bio: "Fast cargo van for metro same-day runs.",
    rateHourly: 45,
    rateUnit: "hour",
    insured: true,
    backgroundChecked: true,
    vehicleMake: "Ford",
    vehicleModel: "Transit 250",
    vehicleYear: 2023,
    vehicleCapacityLbs: 3500,
    vehicleLengthFt: null,
  },
  {
    id: "d3",
    name: "James Okonkwo",
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    verified: true,
    rating: 5.0,
    reviewCount: 56,
    vehicleType: "Flatbed",
    vehicleTags: ["flatbed", "cdl_class_a", "owner_operator", "hazmat"],
    licenseClass: "CDL Class A",
    yearsExperience: 12,
    availability: "busy",
    distanceMi: 14.5,
    responseTimeMin: 12,
    completedJobs: 980,
    skills: ["Steel", "Lumber", "Oversized"],
    certifications: ["Hazmat Endorsement", "Doubles/Triples"],
    routes: ["regional", "otr", "hazmat"],
    city: "Fort Worth, TX",
    joinedAt: "2023-05-20",
    bio: "OTR flatbed with hazmat endorsement.",
    rateHourly: 85,
    rateUnit: "hour",
    insured: true,
    backgroundChecked: true,
    vehicleMake: "Peterbilt",
    vehicleModel: "567 Flatbed",
    vehicleYear: 2020,
    vehicleCapacityLbs: 48000,
    vehicleLengthFt: 48,
  },
  {
    id: "d4",
    name: "Sofia Alvarez",
    photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    verified: true,
    rating: 4.7,
    reviewCount: 71,
    vehicleType: "Pickup",
    vehicleTags: ["pickup", "non_cdl"],
    licenseClass: "Non-CDL",
    yearsExperience: 3,
    availability: "available",
    distanceMi: 6.1,
    responseTimeMin: 6,
    completedJobs: 188,
    skills: ["Junk removal assist", "Small loads", "Weekend"],
    certifications: ["Insured"],
    routes: ["local"],
    city: "Plano, TX",
    joinedAt: "2025-01-15",
    bio: "Pickup truck for small local hauls.",
    rateHourly: 40,
    rateUnit: "hour",
    insured: true,
    backgroundChecked: false,
    vehicleMake: "Toyota",
    vehicleModel: "Tundra",
    vehicleYear: 2022,
    vehicleCapacityLbs: 1800,
    vehicleLengthFt: null,
  },
  {
    id: "d5",
    name: "Derek Nguyen",
    photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
    verified: true,
    rating: 4.6,
    reviewCount: 203,
    vehicleType: "Semi / Tractor",
    vehicleTags: ["cdl_class_a", "owner_operator"],
    licenseClass: "CDL Class A",
    yearsExperience: 15,
    availability: "available",
    distanceMi: 22.0,
    responseTimeMin: 18,
    completedJobs: 1540,
    skills: ["Dry van", "Team optional", "Reefer partner"],
    certifications: ["Clean MVR", "TWIC"],
    routes: ["otr", "regional"],
    city: "Arlington, TX",
    joinedAt: "2022-11-03",
    bio: "Owner-operator Class A — regional & OTR.",
    rateHourly: 95,
    rateUnit: "hour",
    insured: true,
    backgroundChecked: true,
    vehicleMake: "Freightliner",
    vehicleModel: "Cascadia",
    vehicleYear: 2019,
    vehicleCapacityLbs: 45000,
    vehicleLengthFt: 53,
  },
  {
    id: "d6",
    name: "Priya Shah",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop",
    verified: false,
    rating: 4.4,
    reviewCount: 19,
    vehicleType: "Cargo Van",
    vehicleTags: ["cargo_van", "non_cdl"],
    licenseClass: "Non-CDL",
    yearsExperience: 2,
    availability: "offline",
    distanceMi: 9.4,
    responseTimeMin: 25,
    completedJobs: 67,
    skills: ["Medical courier", "Temperature sensitive"],
    certifications: ["HIPAA awareness"],
    routes: ["local"],
    city: "Irving, TX",
    joinedAt: "2025-09-10",
    bio: "Medical & parcel courier — evenings.",
    rateHourly: 38,
    rateUnit: "hour",
    insured: false,
    backgroundChecked: true,
    vehicleMake: "Ram",
    vehicleModel: "ProMaster City",
    vehicleYear: 2021,
    vehicleCapacityLbs: 1900,
    vehicleLengthFt: null,
  },
  {
    id: "d7",
    name: "Carlos Mendes",
    photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop",
    verified: true,
    rating: 4.9,
    reviewCount: 142,
    vehicleType: "Box Truck",
    vehicleTags: ["box_truck", "cdl_class_b"],
    licenseClass: "CDL Class B",
    yearsExperience: 7,
    availability: "available",
    distanceMi: 4.7,
    responseTimeMin: 5,
    completedJobs: 520,
    skills: ["Moving assist", "Appliance", "Pallet jack"],
    certifications: ["DOT Medical"],
    routes: ["local", "regional"],
    city: "Dallas, TX",
    joinedAt: "2023-09-18",
    bio: "26' box truck — local & regional.",
    rateHourly: 58,
    rateUnit: "hour",
    insured: true,
    backgroundChecked: true,
    vehicleMake: "Hino",
    vehicleModel: "195",
    vehicleYear: 2022,
    vehicleCapacityLbs: 12000,
    vehicleLengthFt: 26,
  },
  {
    id: "d8",
    name: "Emily Brooks",
    photo: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop",
    verified: true,
    rating: 4.8,
    reviewCount: 88,
    vehicleType: "Flatbed",
    vehicleTags: ["flatbed", "cdl_class_a", "hazmat"],
    licenseClass: "CDL Class A",
    yearsExperience: 9,
    availability: "available",
    distanceMi: 18.2,
    responseTimeMin: 9,
    completedJobs: 701,
    skills: ["Construction materials", "Pipe", "Machinery"],
    certifications: ["Hazmat", "Tanker"],
    routes: ["regional", "otr", "hazmat"],
    city: "McKinney, TX",
    joinedAt: "2023-03-02",
    bio: "Hazmat flatbed — regional & OTR.",
    rateHourly: 80,
    rateUnit: "hour",
    insured: true,
    backgroundChecked: true,
    vehicleMake: "Kenworth",
    vehicleModel: "T680 Flatbed",
    vehicleYear: 2021,
    vehicleCapacityLbs: 48000,
    vehicleLengthFt: 48,
  },
];

function readSeed() {
  try {
    const raw = localStorage.getItem(SEED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(SEED_KEY, JSON.stringify(SEED_DRIVERS));
  } catch {
    /* ignore */
  }
  return SEED_DRIVERS;
}

export function listDrivers() {
  return readSeed().map(normalizeDriver);
}

/** @param {string} id */
export function getDriverById(id) {
  if (!id) return null;
  return listDrivers().find((d) => d.id === id) || null;
}

/**
 * Ensure every driver profile has the marketplace fields + sample reviews.
 */
export function normalizeDriver(raw = {}) {
  const reviews = Array.isArray(raw.reviews) && raw.reviews.length
    ? raw.reviews
    : buildSeedReviews(raw);

  return {
    id: raw.id,
    photo: raw.photo || "",
    name: raw.name || "Driver",
    rating: Number(raw.rating) || 0,
    reviewCount: Number(raw.reviewCount) || reviews.length,
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
    reviews,
  };
}

function buildSeedReviews(driver) {
  const name = driver?.name?.split(" ")[0] || "this driver";
  const base = [
    {
      id: `${driver.id}-r1`,
      author: "Jordan P.",
      rating: 5,
      body: `${name} showed up on time, communicated clearly, and handled the load carefully.`,
      created_at: "2026-05-12",
      job_type: "Local delivery",
    },
    {
      id: `${driver.id}-r2`,
      author: "Samira K.",
      rating: 5,
      body: "Professional and easy to work with. Would hire again for same-day runs.",
      created_at: "2026-03-28",
      job_type: "Same-day haul",
    },
    {
      id: `${driver.id}-r3`,
      author: "Chris L.",
      rating: 4,
      body: "Solid experience with the vehicle type we needed. Smooth handoff at the warehouse.",
      created_at: "2026-01-09",
      job_type: "Warehouse transfer",
    },
  ];
  // Vary count slightly by rating
  if ((driver.rating || 0) >= 4.9) return base;
  if ((driver.rating || 0) >= 4.6) return base.slice(0, 2);
  return base.slice(0, 1);
}

export function verificationStatusLabel(status) {
  const map = {
    verified: "Verified",
    pending: "Pending review",
    unverified: "Unverified",
  };
  return map[status] || map.unverified;
}

export function verificationStatusClass(status) {
  const map = {
    verified: "bg-success/15 text-success",
    pending: "bg-warning/15 text-warning",
    unverified: "bg-muted text-muted-foreground",
  };
  return map[status] || map.unverified;
}

/** Display rate for marketplace cards */
export function formatDriverRate(driver) {
  const n = Number(driver?.rateHourly);
  if (!Number.isFinite(n) || n <= 0) return "Rate on request";
  return `$${Math.round(n)}/hr`;
}

/** Compact vehicle line for cards */
export function formatVehicleSummary(driver) {
  if (!driver) return "Vehicle";
  const parts = [
    driver.vehicleYear,
    driver.vehicleMake,
    driver.vehicleModel,
  ].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return driver.vehicleType || "Vehicle";
}

/** Capacity / length for profile */
export function formatVehicleSpecs(driver) {
  if (!driver) return [];
  const specs = [];
  if (driver.vehicleType) specs.push({ label: "Type", value: driver.vehicleType });
  if (driver.vehicleLengthFt) specs.push({ label: "Length", value: `${driver.vehicleLengthFt} ft` });
  if (driver.vehicleCapacityLbs) {
    specs.push({
      label: "Capacity",
      value:
        driver.vehicleCapacityLbs >= 1000
          ? `${Math.round(driver.vehicleCapacityLbs / 1000)}k lbs`
          : `${driver.vehicleCapacityLbs} lbs`,
    });
  }
  if (driver.licenseClass) specs.push({ label: "License", value: driver.licenseClass });
  return specs;
}

/** Simple Levenshtein for typo tolerance */
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
  return words.some((w) => {
    if (w.startsWith(n) || n.startsWith(w)) return true;
    const maxDist = n.length <= 4 ? 1 : 2;
    return editDistance(w, n) <= maxDist;
  });
}

/**
 * Filter directory drivers by search, tags, availability, rating, distance, trust, and collection ids.
 *
 * @param {object[]} drivers
 * @param {object} [opts]
 * @param {string} [opts.query]
 * @param {{ license?: string[], vehicle?: string[], route?: string[] }} [opts.filters]
 * @param {string} [opts.availability]
 * @param {number} [opts.minRating]
 * @param {number | null} [opts.maxDistance]
 * @param {string} [opts.trust]
 * @param {Set<string> | string[] | null} [opts.collectionIds]
 * @returns {object[]}
 */
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
  const idSet = collectionIds instanceof Set ? collectionIds : collectionIds ? new Set(collectionIds) : null;

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

/**
 * Sort drivers by rating, distance, newest, jobs, response, rate, or trust.
 * @param {object[]} drivers
 * @param {string} [sortBy]
 * @returns {object[]}
 */
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
        (a, b) =>
          trustRank(b) - trustRank(a) ||
          b.rating - a.rating ||
          b.reviewCount - a.reviewCount
      );
    case "rating":
    default:
      return rows.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  }
}

export function availabilityLabel(status) {
  return (
    {
      available: "Available now",
      busy: "On a job",
      offline: "Offline",
    }[status] || status
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
