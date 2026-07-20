/** Common vehicle makes + models for Fleet / Driver Hub pickers. */
export const VEHICLE_MAKES = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "GMC",
  "Honda",
  "Hyundai",
  "Jeep",
  "Kia",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "Nissan",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
  "Other",
];

export const VEHICLE_MODELS = {
  Acura: ["ILX", "Integra", "MDX", "RDX", "TLX"],
  Audi: ["A3", "A4", "A6", "Q3", "Q5", "Q7"],
  BMW: ["3 Series", "5 Series", "X1", "X3", "X5"],
  Buick: ["Enclave", "Encore", "Envision"],
  Cadillac: ["CT4", "CT5", "Escalade", "XT4", "XT5"],
  Chevrolet: ["Equinox", "Malibu", "Silverado", "Suburban", "Tahoe", "Traverse", "Bolt"],
  Chrysler: ["300", "Pacifica", "Voyager"],
  Dodge: ["Charger", "Durango", "Hornet"],
  Ford: ["Escape", "Explorer", "F-150", "Maverick", "Mustang", "Ranger", "Transit"],
  GMC: ["Acadia", "Canyon", "Sierra", "Terrain", "Yukon"],
  Honda: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Pilot", "Ridgeline"],
  Hyundai: ["Elantra", "Ioniq", "Santa Fe", "Sonata", "Tucson"],
  Jeep: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Wrangler"],
  Kia: ["Forte", "K5", "Sportage", "Sorento", "Telluride"],
  Lexus: ["ES", "NX", "RX", "UX"],
  Mazda: ["CX-5", "CX-50", "CX-90", "Mazda3", "Mazda6"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE", "Sprinter"],
  Nissan: ["Altima", "Frontier", "Leaf", "Rogue", "Sentra", "Pathfinder"],
  Ram: ["1500", "2500", "ProMaster"],
  Subaru: ["Ascent", "Crosstrek", "Forester", "Outback"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"],
  Toyota: ["Camry", "Corolla", "Highlander", "Prius", "RAV4", "Sienna", "Tacoma", "Tundra"],
  Volkswagen: ["Atlas", "Golf", "ID.4", "Jetta", "Tiguan"],
  Volvo: ["S60", "XC40", "XC60", "XC90"],
  Other: ["Custom / Other"],
};

export function modelsForMake(make) {
  if (!make) return [];
  return VEHICLE_MODELS[make] || VEHICLE_MODELS.Other;
}

export function vehicleDisplayName(row = {}) {
  const parts = [row.year, row.make, row.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return row.name || "Vehicle";
}

export function vehicleLabel(row = {}) {
  const base = vehicleDisplayName(row);
  if (row.name && row.name !== base && row.make) return `${base} · ${row.name}`;
  return base;
}

/** Current year down to 1995 for year pickers. */
export function vehicleYearOptions(span = 35) {
  const now = new Date().getFullYear() + 1;
  return Array.from({ length: span }, (_, i) => String(now - i));
}
