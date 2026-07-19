import { api } from "@/api/apiClient";
import { estimateJobPrice, MARKET_HOURLY } from "@/lib/priceEstimator";

export async function generateAiEstimateDraft(prompt, userContext = {}) {
  try {
    const response = await api.functions.invoke("titanAI", { message: `Create a concise field-service estimate draft. Request: ${prompt}. Context: ${JSON.stringify(userContext)}` });
    const text = response?.data?.message || response?.message || response?.text;
    if (text) return { text, fields: {} };
  } catch { /* use local heuristic */ }
  const lower = String(prompt).toLowerCase();
  const service = Object.keys(MARKET_HOURLY).find((name) => lower.includes(name.toLowerCase())) || "General";
  const hours = lower.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)/)?.[1] || 2;
  const fields = { service_type: service, hours: Number(hours), labor_rate: MARKET_HOURLY[service] || MARKET_HOURLY.General, materials: lower.includes("material") ? 75 : 0 };
  const estimate = estimateJobPrice({ ...fields, equipment: 0, mileage: 0, difficulty: "standard", urgency: "normal", market_rate_factor: 1 });
  return { fields, text: `Suggested ${service} estimate: ${hours} labor hours at $${fields.labor_rate}/hr, with a customer price around $${estimate.suggested_price}.` };
}
