import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { readJson } from "../_lib/supabase.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MAX_RESULTS = 20;
const MAX_RADIUS_M = 40_000;
const CACHE_TTL_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const SEARCH_COORD_DECIMALS = 3;

const cache = globalThis.__titanLeadDiscoveryCache || new Map();
globalThis.__titanLeadDiscoveryCache = cache;

const CATEGORY_FILTERS = [
  [/\b(restaurants?|food|cafe|coffee)\b/i, ['["amenity"~"restaurant|cafe|fast_food",i]']],
  [/\b(hotels?|lodging|motel)\b/i, ['["tourism"~"hotel|motel|guest_house",i]']],
  [/\b(real estate|realtors?|estate agents?)\b/i, ['["office"="estate_agent"]']],
  [/\b(plumb|plumber)\b/i, ['["craft"="plumber"]']],
  [/\b(electric|electrician)\b/i, ['["craft"="electrician"]']],
  [/\b(roof|roofer|roofing)\b/i, ['["craft"="roofer"]']],
  [/\b(paint|painter)\b/i, ['["craft"="painter"]']],
  [/\b(carpent|carpenter)\b/i, ['["craft"="carpenter"]']],
  [/\b(auto|car repair|mechanic)\b/i, ['["shop"~"car_repair|car",i]']],
  [/\b(clinic|doctor|medical|health)\b/i, ['["amenity"~"clinic|doctors|dentist",i]']],
  [/\b(retail|store|shop)\b/i, ['["shop"]']],
  [/\b(gym|fitness)\b/i, ['["leisure"="fitness_centre"]']],
  [/\b(church|worship)\b/i, ['["amenity"="place_of_worship"]']],
  [/\b(school|daycare|childcare)\b/i, ['["amenity"~"school|kindergarten|childcare",i]']],
];

function cleanText(value, max = 100) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundedCoordinate(value) {
  const scale = 10 ** SEARCH_COORD_DECIMALS;
  return Math.round(value * scale) / scale;
}

function safeHttpUrl(value) {
  const raw = cleanText(value, 300);
  if (!raw) return "";
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return "";
    return parsed.toString().slice(0, 300);
  } catch {
    return "";
  }
}

function escapeRegex(value) {
  return String(value || "")
    .replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")
    .replace(/"/g, '\\"')
    .slice(0, 60);
}

function filtersFor(query) {
  const found = CATEGORY_FILTERS.find(([pattern]) => pattern.test(query));
  return found?.[1] || [];
}

function buildOverpassQuery({ query, lat, lng, radiusM, limit }) {
  const categoryFilters = filtersFor(query);
  const safeQuery = escapeRegex(query);
  const statements = [];

  for (const filter of categoryFilters) {
    statements.push(`nwr(around:${radiusM},${lat},${lng})["name"]${filter};`);
  }

  if (safeQuery.length >= 2) {
    statements.push(`nwr(around:${radiusM},${lat},${lng})["name"~"${safeQuery}",i];`);
  }

  if (!statements.length) {
    statements.push(`nwr(around:${radiusM},${lat},${lng})["name"]["office"];`);
  }

  return `[out:json][timeout:8];(${statements.join("")});out center ${limit};`;
}

function addressFrom(tags = {}) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const locality = [tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(Boolean).join(", ");
  return [street, locality].filter(Boolean).join(", ");
}

function normalizeElement(element = {}) {
  const tags = element.tags || {};
  const lat = finiteNumber(element.lat ?? element.center?.lat);
  const lng = finiteNumber(element.lon ?? element.center?.lon);
  const name = cleanText(tags.name || tags.brand || tags.operator, 160);
  if (!name || lat == null || lng == null) return null;

  const type = cleanText(element.type, 12);
  const id = String(element.id || "").replace(/[^0-9]/g, "");
  const phone = cleanText(tags["contact:phone"] || tags.phone, 80);
  const email = cleanText(tags["contact:email"] || tags.email, 160);
  const website = safeHttpUrl(tags["contact:website"] || tags.website || tags.url);
  const category = cleanText(
    tags.amenity || tags.shop || tags.craft || tags.office || tags.tourism || tags.leisure || "business",
    80
  );

  return {
    external_id: id ? `osm:${type}:${id}` : `osm:${name}:${lat}:${lng}`,
    name,
    phone,
    email,
    website,
    address: addressFrom(tags),
    city: cleanText(tags["addr:city"], 100),
    state: cleanText(tags["addr:state"], 80),
    category,
    lat,
    lng,
    source: "OpenStreetMap",
    source_url: id && type ? `https://www.openstreetmap.org/${type}/${id}` : "https://www.openstreetmap.org/",
  };
}

function dedupe(results) {
  const seen = new Set();
  const output = [];
  for (const result of results) {
    if (!result) continue;
    const key = `${result.name.toLowerCase()}|${result.address.toLowerCase()}|${result.phone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(result);
  }
  return output;
}

async function fetchNearbyBusinesses(input) {
  const key = `${input.query.toLowerCase()}|${input.lat.toFixed(3)}|${input.lng.toFixed(3)}|${input.radiusM}|${input.limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { ...cached.value, cached: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const query = buildOverpassQuery(input);
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": "TitanOS/2.0 (https://titanos-web.vercel.app)",
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`Lead discovery provider returned ${response.status}`);
      error.status = response.status === 429 ? 429 : 503;
      throw error;
    }

    const body = await response.json().catch(() => ({}));
    const results = dedupe((Array.isArray(body.elements) ? body.elements : []).map(normalizeElement)).slice(0, input.limit);
    const value = { results, provider: "OpenStreetMap", cached: false };
    cache.set(key, { at: Date.now(), value });

    if (cache.size > 100) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, cache.size - 80);
      for (const [oldKey] of oldest) cache.delete(oldKey);
    }

    return value;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 4, windowMs: 60_000, key: "leadDiscovery" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const query = cleanText(body.query, 80);
    const lat = finiteNumber(body.lat);
    const lng = finiteNumber(body.lng);
    const radiusMiles = Math.min(25, Math.max(1, finiteNumber(body.radius_miles) || 10));
    const limit = Math.min(MAX_RESULTS, Math.max(1, Math.trunc(finiteNumber(body.limit) || 12)));

    if (query.length < 2) return res.status(400).json({ error: "Enter a business type or name to find leads." });
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "A valid search location is required." });
    }

    // Nearby discovery does not require exact device coordinates. Reduce precision
    // before transmitting the lookup to the public place-data provider.
    const searchLat = roundedCoordinate(lat);
    const searchLng = roundedCoordinate(lng);
    const result = await fetchNearbyBusinesses({
      query,
      lat: searchLat,
      lng: searchLng,
      radiusM: Math.min(MAX_RADIUS_M, Math.round(radiusMiles * 1609.344)),
      limit,
    });

    return res.status(200).json({
      data: {
        ...result,
        query,
        radius_miles: radiusMiles,
        location_precision: `${SEARCH_COORD_DECIMALS} decimal places`,
        attribution: "Business place data © OpenStreetMap contributors",
      },
    });
  } catch (error) {
    logError("leadDiscovery", error);
    captureApiException(error, { tags: { route: "leadDiscovery" } });
    const status = Number(error?.status || 0);
    return res.status(status === 429 ? 429 : 503).json({
      error: status === 429
        ? "Lead discovery is busy. Try again shortly."
        : "Nearby lead discovery is temporarily unavailable.",
    });
  }
}
