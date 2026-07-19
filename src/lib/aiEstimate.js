import { api } from "@/api/apiClient";
import { estimateJobPrice, MARKET_HOURLY } from "@/lib/priceEstimator";

function buildLineItems(fields) {
  const labor = Math.round((Number(fields.hours) || 0) * (Number(fields.labor_rate) || 0) * 100) / 100;
  const materials = Number(fields.materials) || 0;
  const equipment = Number(fields.equipment) || 0;
  const items = [];
  if (labor > 0) {
    items.push({
      description: `${fields.service_type || "Labor"} (${fields.hours} hrs @ $${fields.labor_rate}/hr)`,
      qty: 1,
      unit_price: labor,
      total: labor,
    });
  }
  if (materials > 0) items.push({ description: "Materials", qty: 1, unit_price: materials, total: materials });
  if (equipment > 0) items.push({ description: "Equipment", qty: 1, unit_price: equipment, total: equipment });
  return items;
}

function heuristicFromPrompt(prompt) {
  const lower = String(prompt).toLowerCase();
  const service = Object.keys(MARKET_HOURLY).find((name) => lower.includes(name.toLowerCase())) || "General";
  const stories = lower.match(/(\d+)\s*(?:story|storey|stories)/)?.[1];
  const hoursMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)/)?.[1];
  let hours = hoursMatch ? Number(hoursMatch) : 2;
  if (stories) hours = Math.max(hours, Number(stories) * 2.5);
  if (/driveway|sidewalk|walkway/.test(lower)) hours = Math.max(hours, 1.5);
  if (/roof|2-story|2 story|two story/.test(lower)) hours = Math.max(hours, 4);
  if (/commercial|warehouse/.test(lower)) hours = Math.max(hours, 6);

  let materials = 0;
  if (/material|chemical|soap|sealer/.test(lower)) materials = 75;
  if (/paint|stain/.test(lower)) materials = Math.max(materials, 120);
  let equipment = /lift|scaffold|trailer/.test(lower) ? 85 : 0;
  const difficulty = /hard|difficult|steep|multi/.test(lower) ? "hard" : /easy|simple/.test(lower) ? "easy" : "standard";
  const urgency = /emergency|asap|same.?day/.test(lower) ? "same_day" : /soon|urgent/.test(lower) ? "soon" : "normal";

  const fields = {
    service_type: service,
    hours,
    labor_rate: MARKET_HOURLY[service] || MARKET_HOURLY.General,
    materials,
    equipment,
    mileage: /miles?|drive|travel/.test(lower) ? 20 : 0,
    difficulty,
    urgency,
    market_rate_factor: 1,
  };
  const estimate = estimateJobPrice(fields);
  const line_items = buildLineItems(fields);
  const market_low = Math.round(estimate.suggested_price * 0.85);
  const market_high = Math.round(estimate.suggested_price * 1.2);
  return {
    fields,
    line_items,
    estimate,
    market_range: { low: market_low, high: market_high },
    text: `Suggested ${service}: ~${hours} labor hrs, materials $${materials}, equipment $${equipment}. Customer price ~$${estimate.suggested_price} (local range $${market_low}–$${market_high}). Profit ~$${estimate.profit_estimate}.`,
  };
}

/** Full AI estimate: structured fields + line items + market range. */
export async function generateAiEstimateDraft(prompt, userContext = {}) {
  const local = heuristicFromPrompt(prompt);
  try {
    const response = await api.functions.invoke("titanAI", {
      message: `Return a short field-service estimate summary for: ${prompt}. Context: ${JSON.stringify(userContext)}. Include labor hours, materials, suggested price.`,
    });
    const text = response?.data?.message || response?.message || response?.text;
    if (text) {
      return { ...local, text: `${local.text}\n\nAI notes: ${text}` };
    }
  } catch {
    /* heuristic only */
  }
  return local;
}

export { buildLineItems };
