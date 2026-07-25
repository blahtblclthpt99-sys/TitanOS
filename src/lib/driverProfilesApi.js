/**
 * Live driver profiles — Supabase when available, device cache for own draft.
 * No fake seed drivers.
 */
import { supabase } from "@/api/supabaseClient";
import {
  capacityToLegacyVehicleFields,
  emptyVehicleCapacity,
  normalizeVehicleCapacity,
} from "@/lib/vehicleCapacity";

const LOCAL_OWN_KEY = "titanos_my_driver_profile_v1";

function capacityFromRow(row) {
  const raw = row?.vehicle_capacity;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length) {
    return normalizeVehicleCapacity(raw);
  }
  // Seed from legacy columns so older profiles still show something useful
  return emptyVehicleCapacity({
    identity: {
      vehicleType: row?.vehicle_type || "",
      year: row?.vehicle_year != null ? Number(row.vehicle_year) : null,
      make: row?.vehicle_make || "",
      model: row?.vehicle_model || "",
    },
    weight: {
      maxPayloadLb:
        row?.vehicle_capacity_lbs != null ? Number(row.vehicle_capacity_lbs) : null,
    },
    dimensions: {
      cargoLengthIn:
        row?.vehicle_length_ft != null ? Number(row.vehicle_length_ft) * 12 : null,
    },
  });
}

function haversineMi(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(Number(n)))) return null;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function rowToDriver(row, viewer = null) {
  if (!row) return null;
  const lat = row.lat != null ? Number(row.lat) : null;
  const lng = row.lng != null ? Number(row.lng) : null;
  const distanceMi =
    viewer?.lat != null && viewer?.lng != null && lat != null && lng != null
      ? haversineMi(viewer.lat, viewer.lng, lat, lng)
      : Number(row.distance_mi) || 0;

  const cityLabel = [row.city, row.state].filter(Boolean).join(", ");

  return {
    id: row.id,
    userId: row.user_id,
    photo: row.photo_url || "",
    name: row.name || "Driver",
    rating: Number(row.rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    verified: Boolean(row.id_verified),
    insured: Boolean(row.insured),
    backgroundChecked: Boolean(row.background_checked),
    verificationStatus: row.id_verified ? "verified" : "unverified",
    licenseClass: row.license_class || "Non-CDL",
    licenseType: row.license_class || "Non-CDL",
    vehicleType: row.vehicle_type || "Vehicle",
    vehicleTags: row.vehicle_tags || [],
    vehicleMake: row.vehicle_make || "",
    vehicleModel: row.vehicle_model || "",
    vehicleYear: row.vehicle_year != null ? Number(row.vehicle_year) : null,
    vehicleCapacityLbs:
      row.vehicle_capacity_lbs != null ? Number(row.vehicle_capacity_lbs) : null,
    vehicleLengthFt: row.vehicle_length_ft != null ? Number(row.vehicle_length_ft) : null,
    vehicleCapacity: capacityFromRow(row),
    yearsExperience: Number(row.years_experience) || 0,
    city: cityLabel,
    location: cityLabel,
    lat,
    lng,
    distanceMi: distanceMi ?? 0,
    availability: row.availability || "offline",
    completedJobs: Number(row.completed_jobs) || 0,
    responseTimeMin: Number(row.response_time_min) || 0,
    skills: row.skills || [],
    certifications: row.certifications || [],
    routes: row.routes || [],
    bio: row.bio || "",
    rateHourly: Number(row.rate_hourly) || 0,
    rateUnit: "hour",
    joinedAt: row.created_at ? String(row.created_at).slice(0, 10) : "",
    published: Boolean(row.published),
    reviews: Array.isArray(row.reviews) ? row.reviews : [],
  };
}

function driverToRow(driver, userId) {
  const cityParts = String(driver.city || "")
    .split(",")
    .map((s) => s.trim());
  const capacity = normalizeVehicleCapacity(
    driver.vehicleCapacity || emptyVehicleCapacity()
  );
  const legacyFromCap = capacityToLegacyVehicleFields(capacity);
  const vehicleType =
    String(driver.vehicleType || legacyFromCap.vehicleType || "").trim() ||
    String(capacity.identity.vehicleType || "").trim();
  const vehicleMake =
    String(driver.vehicleMake || legacyFromCap.vehicleMake || "").trim() ||
    String(capacity.identity.make || "").trim();
  const vehicleModel =
    String(driver.vehicleModel || legacyFromCap.vehicleModel || "").trim() ||
    String(capacity.identity.model || "").trim();
  const vehicleYear =
    driver.vehicleYear != null
      ? Number(driver.vehicleYear)
      : legacyFromCap.vehicleYear != null
        ? Number(legacyFromCap.vehicleYear)
        : capacity.identity.year != null
          ? Number(capacity.identity.year)
          : null;
  const vehicleCapacityLbs =
    driver.vehicleCapacityLbs != null
      ? Number(driver.vehicleCapacityLbs)
      : legacyFromCap.vehicleCapacityLbs != null
        ? Number(legacyFromCap.vehicleCapacityLbs)
        : null;
  const vehicleLengthFt =
    driver.vehicleLengthFt != null
      ? Number(driver.vehicleLengthFt)
      : legacyFromCap.vehicleLengthFt != null
        ? Number(legacyFromCap.vehicleLengthFt)
        : null;

  return {
    user_id: userId,
    created_by_id: userId,
    name: String(driver.name || "").trim() || "Driver",
    bio: String(driver.bio || "").trim(),
    photo_url: String(driver.photo || driver.photo_url || "").trim(),
    city: cityParts[0] || String(driver.city || "").trim(),
    state: cityParts[1] || String(driver.state || "").trim(),
    zip: String(driver.zip || "").trim(),
    lat: driver.lat != null ? Number(driver.lat) : null,
    lng: driver.lng != null ? Number(driver.lng) : null,
    vehicle_type: vehicleType,
    vehicle_make: vehicleMake,
    vehicle_model: vehicleModel,
    vehicle_year: vehicleYear,
    vehicle_capacity_lbs: vehicleCapacityLbs,
    vehicle_length_ft: vehicleLengthFt,
    vehicle_capacity: capacity,
    vehicle_tags: Array.isArray(driver.vehicleTags) ? driver.vehicleTags : [],
    license_class: String(driver.licenseClass || "Non-CDL"),
    years_experience: Number(driver.yearsExperience) || 0,
    rate_hourly: Number(driver.rateHourly) || 0,
    availability: driver.availability || "offline",
    routes: Array.isArray(driver.routes) ? driver.routes : [],
    skills: Array.isArray(driver.skills) ? driver.skills : [],
    certifications: Array.isArray(driver.certifications) ? driver.certifications : [],
    insured: Boolean(driver.insured),
    background_checked: Boolean(driver.backgroundChecked),
    // id_verified is server/admin only — never accept from client upsert
    published: Boolean(driver.published),
    updated_at: new Date().toISOString(),
  };
}

function readLocalOwn(userId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_OWN_KEY}:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocalOwn(userId, row) {
  try {
    localStorage.setItem(`${LOCAL_OWN_KEY}:${userId}`, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

/** List published drivers (+ optionally include own unpublished). */
export async function listPublishedDrivers({ viewerLat = null, viewerLng = null } = {}) {
  try {
    const { data, error } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("published", true)
      .order("rating", { ascending: false })
      .limit(200);
    if (error) throw error;
    const viewer =
      viewerLat != null && viewerLng != null ? { lat: viewerLat, lng: viewerLng } : null;
    return (data || []).map((row) => rowToDriver(row, viewer));
  } catch {
    return [];
  }
}

export async function getDriverProfileById(id, viewer = null) {
  if (!id) return null;
  try {
    const { data, error } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return rowToDriver(data, viewer);
  } catch {
    return null;
  }
}

export async function getMyDriverProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      writeLocalOwn(userId, data);
      return rowToDriver(data);
    }
  } catch {
    /* fall through to local */
  }
  const local = readLocalOwn(userId);
  return local ? rowToDriver(local) : null;
}

/**
 * Upsert own driver profile. Set published=true to appear in directory.
 */
export async function saveMyDriverProfile(userId, patch) {
  if (!userId) throw new Error("Sign in to publish a driver profile.");
  const existing = await getMyDriverProfile(userId);
  const merged = {
    ...(existing || {}),
    ...patch,
    id: existing?.id,
    userId,
  };
  const row = driverToRow(merged, userId);

  try {
    const { data, error } = await supabase
      .from("driver_profiles")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();
    if (error) {
      // Pre-024 databases: retry without vehicle_capacity JSON column
      const missingCapacityCol =
        error?.code === "PGRST204" ||
        /vehicle_capacity/i.test(String(error?.message || ""));
      if (missingCapacityCol && row.vehicle_capacity != null) {
        const { vehicle_capacity: _drop, ...withoutCapacity } = row;
        const retry = await supabase
          .from("driver_profiles")
          .upsert(withoutCapacity, { onConflict: "user_id" })
          .select("*")
          .maybeSingle();
        if (retry.error) throw retry.error;
        writeLocalOwn(userId, { ...retry.data, vehicle_capacity: row.vehicle_capacity });
        return rowToDriver({ ...retry.data, vehicle_capacity: row.vehicle_capacity });
      }
      throw error;
    }
    writeLocalOwn(userId, data);
    return rowToDriver(data);
  } catch (err) {
    // Offline / table missing — keep draft on device only (not in public directory)
    const localRow = {
      id: existing?.id || `local-${userId}`,
      ...row,
      user_id: userId,
      created_at: existing?.joinedAt || new Date().toISOString(),
    };
    writeLocalOwn(userId, localRow);
    if (row.published) {
      throw new Error(
        err?.message?.includes("driver_profiles") || err?.code === "PGRST205"
          ? "Driver profiles table is not set up yet. Run migration 022 in Supabase, then try again."
          : err?.message?.includes("vehicle_capacity") || err?.code === "PGRST204"
            ? "Vehicle capacity column missing. Run migration 024 in Supabase, then try again."
            : err?.message || "Could not publish profile. Check your connection."
      );
    }
    return rowToDriver(localRow);
  }
}

export async function setMyAvailability(userId, availability) {
  return saveMyDriverProfile(userId, { availability, published: availability === "available" ? true : undefined });
}
