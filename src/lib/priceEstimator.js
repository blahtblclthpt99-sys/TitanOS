/**
 * Job Price Estimator — fair-price ranges from labor, materials, market inputs.
 * Designed so AI market-rate lookup can plug in later without rewriting UI.
 */
const DIFFICULTY_MULT = { easy: 0.9, standard: 1, hard: 1.2, expert: 1.45 };
const URGENCY_MULT = { normal: 1, soon: 1.12, same_day: 1.28, emergency: 1.5 };

/** Rough US market hourly baselines by service (can be replaced by live rates). */
export const MARKET_HOURLY = {
  General: 65,
  HVAC: 95,
  Plumbing: 90,
  Electrical: 95,
  Landscaping: 55,
  "Lawn Care": 45,
  "Pressure Washing": 70,
  Cleaning: 45,
  Roofing: 85,
  Flooring: 75,
  Painting: 55,
  "Pest Control": 70,
  Handyman: 60,
  Moving: 50,
  Other: 60,
};

export function estimateJobPrice(inputs) {
  const hours = Math.max(0, Number(inputs.hours) || 0);
  const laborRate = Math.max(0, Number(inputs.labor_rate) || MARKET_HOURLY[inputs.service_type] || 65);
  const materials = Math.max(0, Number(inputs.materials) || 0);
  const equipment = Math.max(0, Number(inputs.equipment) || 0);
  const mileage = Math.max(0, Number(inputs.mileage) || 0);
  const mileageRate = Math.max(0, Number(inputs.mileage_rate) || 0.67);
  const marketAdj = Math.max(0.5, Number(inputs.market_rate_factor) || 1);
  const difficulty = DIFFICULTY_MULT[inputs.difficulty] || 1;
  const urgency = URGENCY_MULT[inputs.urgency] || 1;

  const laborCost = hours * laborRate;
  const travelCost = mileage * mileageRate;
  const directCost = laborCost + materials + equipment + travelCost;
  const adjusted = directCost * difficulty * urgency * marketAdj;

  const low = Math.round(adjusted * 0.85);
  const avg = Math.round(adjusted);
  const premium = Math.round(adjusted * 1.25);
  const suggested = avg;
  const profit = Math.round(suggested - directCost);

  return {
    labor_cost: Math.round(laborCost),
    travel_cost: Math.round(travelCost),
    materials,
    equipment,
    direct_cost: Math.round(directCost),
    low_estimate: low,
    avg_estimate: avg,
    premium_estimate: premium,
    suggested_price: suggested,
    profit_estimate: profit,
    breakdown: {
      hours,
      laborRate,
      difficulty,
      urgency,
      marketAdj,
    },
  };
}
