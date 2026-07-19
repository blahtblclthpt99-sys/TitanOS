const FALLBACK = { temp: 72, weathercode: 1, wind: 8, warning: null, label: "Partly cloudy" };
const codes = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 51: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 80: "Showers", 95: "Thunderstorm" };
export function weatherWarning(temp, weathercode, wind) {
  if (wind >= 30) return "High winds: secure equipment.";
  if (weathercode >= 51 && weathercode <= 82) return "Rain expected: plan outdoor work carefully.";
  if (temp >= 90) return "Heat alert: schedule hydration breaks.";
  return null;
}
export async function fetchOpenMeteo(lat, lon) {
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`);
    if (!response.ok) throw new Error("Weather unavailable");
    const current = (await response.json()).current;
    const temp = Math.round(current.temperature_2m);
    const weathercode = current.weather_code;
    const wind = Math.round(current.wind_speed_10m);
    return { temp, weathercode, wind, warning: weatherWarning(temp, weathercode, wind), label: codes[weathercode] || "Current conditions" };
  } catch { return FALLBACK; }
}
