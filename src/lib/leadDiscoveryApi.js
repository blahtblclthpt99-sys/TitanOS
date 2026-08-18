import { api } from "@/api/apiClient";

export async function discoverNearbyLeads({ query, lat, lng, radiusMiles = 10, limit = 12 }) {
  const response = await api.functions.invoke("leadDiscovery", {
    query,
    lat,
    lng,
    radius_miles: radiusMiles,
    limit,
  });
  return response?.data || {
    results: [],
    provider: "OpenStreetMap",
    attribution: "Business place data © OpenStreetMap contributors",
  };
}
