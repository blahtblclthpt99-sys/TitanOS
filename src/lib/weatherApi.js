/**
 * Weather via Open-Meteo (no API key).
 * Resolves location: GPS → saved coords → profile city geocode → explicit unset.
 */

const COORDS_KEY = "titanos_weather_coords_v1";

const codes = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  51: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  80: "Showers",
  95: "Thunderstorm",
};

export function weatherWarning(temp, weathercode, wind) {
  if (wind >= 30) return "High winds: secure equipment.";
  if (weathercode >= 51 && weathercode <= 82) return "Rain expected: plan outdoor work carefully.";
  if (temp >= 90) return "Heat alert: schedule hydration breaks.";
  return null;
}

function readSavedCoords() {
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lon = Number(parsed?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return {
      lat,
      lon,
      label: String(parsed.label || "").trim() || null,
      source: parsed.source || "saved",
    };
  } catch {
    return null;
  }
}

export function saveWeatherCoords({ lat, lon, label, source }) {
  try {
    localStorage.setItem(
      COORDS_KEY,
      JSON.stringify({
        lat: Number(lat),
        lon: Number(lon),
        label: label || null,
        source: source || "gps",
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* ignore quota */
  }
}

function getBrowserPosition(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation_unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    );
  });
}

/** Open-Meteo geocoding (free, no key). */
export async function geocodePlace(query) {
  const q = String(query || "").trim();
  if (!q || q.length < 2) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const hit = (await res.json())?.results?.[0];
    if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
    const parts = [hit.name, hit.admin1, hit.country_code].filter(Boolean);
    return {
      lat: hit.latitude,
      lon: hit.longitude,
      label: parts.join(", "),
      source: "geocode",
    };
  } catch {
    return null;
  }
}

async function reverseLabel(lat, lon) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const hit = json?.results?.[0] || json;
    if (hit?.name) {
      return [hit.name, hit.admin1, hit.country_code].filter(Boolean).join(", ");
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Resolve best coords for weather.
 * @param {{ city?: string, state?: string, company_city?: string, company_state?: string } | null} user
 */
export async function resolveWeatherLocation(user = null) {
  // 1) Fresh GPS
  try {
    const gps = await getBrowserPosition();
    let label = await reverseLabel(gps.lat, gps.lon);
    if (!label) label = "Near you";
    const loc = { lat: gps.lat, lon: gps.lon, label, source: "gps" };
    saveWeatherCoords(loc);
    return loc;
  } catch {
    /* fall through */
  }

  // 2) Recently saved GPS/geocode
  const saved = readSavedCoords();
  if (saved) return { ...saved, source: saved.source || "saved" };

  // 3) Profile / company city
  const cityBits = [
    user?.city,
    user?.state,
    user?.company_city,
    user?.company_state,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const query = [...new Set(cityBits)].join(", ");
  if (query) {
    const geo = await geocodePlace(query);
    if (geo) {
      saveWeatherCoords(geo);
      return geo;
    }
  }

  return {
    lat: null,
    lon: null,
    label: null,
    source: "none",
    error: query
      ? "Could not find weather for your profile city. Enable location or update Profile → city."
      : "Enable location access or set your city in Profile for local weather.",
  };
}

export async function fetchOpenMeteo(lat, lon, { label, source } = {}) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return {
      temp: null,
      weathercode: null,
      wind: null,
      warning: null,
      label: "Weather unavailable",
      place: label || null,
      source: source || "none",
      unavailable: true,
    };
  }
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
    );
    if (!response.ok) throw new Error("Weather unavailable");
    const current = (await response.json()).current;
    const temp = Math.round(current.temperature_2m);
    const weathercode = current.weather_code;
    const wind = Math.round(current.wind_speed_10m);
    return {
      temp,
      weathercode,
      wind,
      warning: weatherWarning(temp, weathercode, wind),
      label: codes[weathercode] || "Current conditions",
      place: label || null,
      source: source || "gps",
      lat: Number(lat),
      lon: Number(lon),
      unavailable: false,
    };
  } catch {
    return {
      temp: null,
      weathercode: null,
      wind: null,
      warning: null,
      label: "Weather unavailable",
      place: label || null,
      source: source || "none",
      unavailable: true,
    };
  }
}

/** One-shot: resolve location + fetch forecast. */
export async function loadLocalWeather(user = null) {
  const loc = await resolveWeatherLocation(user);
  if (loc.lat == null || loc.lon == null) {
    return {
      temp: null,
      weathercode: null,
      wind: null,
      warning: null,
      label: "Set your location",
      place: null,
      source: "none",
      unavailable: true,
      locationError: loc.error || null,
    };
  }
  return fetchOpenMeteo(loc.lat, loc.lon, { label: loc.label, source: loc.source });
}
