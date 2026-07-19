/**
 * Trade service templates — install defaults that speed estimates, jobs, invoices.
 */

export const SERVICE_TEMPLATES = [
  {
    id: "pressure_washing",
    name: "Pressure Washing",
    icon: "💧",
    default_hours: 2.5,
    labor_rate: 70,
    materials: 25,
    checklist: ["Inspect hoses and fittings", "Protect nearby surfaces", "Test pressure setting", "Complete rinse and cleanup"],
    estimate_items: [
      { description: "House wash (standard)", qty: 1, unit_price: 250 },
      { description: "Driveway / sidewalk", qty: 1, unit_price: 125 },
    ],
    invoice_items: [
      { description: "Pressure washing service", qty: 1, unit_price: 350 },
    ],
    customer_form: ["Gate code / access notes", "Pets on site?", "Preferred start time"],
  },
  {
    id: "lawn_care",
    name: "Lawn Care",
    icon: "🌿",
    default_hours: 1.5,
    labor_rate: 45,
    materials: 10,
    checklist: ["Inspect area for obstacles", "Mow and edge", "Blow clippings", "Secure gates"],
    estimate_items: [
      { description: "Weekly mow & edge", qty: 1, unit_price: 55 },
      { description: "Seasonal cleanup", qty: 1, unit_price: 150 },
    ],
    invoice_items: [{ description: "Lawn care visit", qty: 1, unit_price: 55 }],
    customer_form: ["Lot size approx", "Mow height preference", "Clippings bagged?"],
  },
  {
    id: "house_cleaning",
    name: "House Cleaning",
    icon: "✨",
    default_hours: 3,
    labor_rate: 45,
    materials: 15,
    checklist: ["Confirm rooms in scope", "Kitchen & baths deep clean", "Floors vacuum/mop", "Final walkthrough"],
    estimate_items: [
      { description: "Standard clean (up to 2 bath)", qty: 1, unit_price: 160 },
      { description: "Deep clean add-on", qty: 1, unit_price: 80 },
    ],
    invoice_items: [{ description: "House cleaning", qty: 1, unit_price: 160 }],
    customer_form: ["Alarm code", "Pets", "Products to avoid"],
  },
  {
    id: "roofing",
    name: "Roofing",
    icon: "🏠",
    default_hours: 8,
    labor_rate: 85,
    materials: 400,
    checklist: ["Safety harness check", "Inspect decking", "Install materials", "Clean job site", "Photo documentation"],
    estimate_items: [
      { description: "Roof repair (labor)", qty: 1, unit_price: 650 },
      { description: "Materials allowance", qty: 1, unit_price: 400 },
    ],
    invoice_items: [{ description: "Roofing work", qty: 1, unit_price: 1050 }],
    customer_form: ["Roof pitch / stories", "Insurance claim?", "Material preference"],
  },
  {
    id: "plumbing",
    name: "Plumbing",
    icon: "🔧",
    default_hours: 2,
    labor_rate: 90,
    materials: 60,
    checklist: ["Shut off water if needed", "Diagnose issue", "Repair / replace", "Test for leaks", "Cleanup"],
    estimate_items: [
      { description: "Diagnostic visit", qty: 1, unit_price: 95 },
      { description: "Repair labor", qty: 1, unit_price: 180 },
    ],
    invoice_items: [{ description: "Plumbing service", qty: 1, unit_price: 275 }],
    customer_form: ["Fixture type", "Water shutoff location", "Urgency"],
  },
  {
    id: "hvac",
    name: "HVAC",
    icon: "❄️",
    default_hours: 2,
    labor_rate: 95,
    materials: 40,
    checklist: ["Inspect filter", "Check thermostat", "Inspect electrical", "Document readings"],
    estimate_items: [
      { description: "Tune-up / inspection", qty: 1, unit_price: 129 },
      { description: "Filter replacement", qty: 1, unit_price: 35 },
    ],
    invoice_items: [{ description: "HVAC service", qty: 1, unit_price: 164 }],
    customer_form: ["System age", "Indoor unit location", "Warranty?"],
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: "⚡",
    default_hours: 2,
    labor_rate: 95,
    materials: 50,
    checklist: ["Power off / lockout", "Inspect connections", "Complete install/repair", "Test circuits", "Restore power"],
    estimate_items: [
      { description: "Service call", qty: 1, unit_price: 110 },
      { description: "Labor", qty: 1, unit_price: 190 },
    ],
    invoice_items: [{ description: "Electrical service", qty: 1, unit_price: 300 }],
    customer_form: ["Panel location", "Permit needed?", "Breaker labels"],
  },
  {
    id: "painting",
    name: "Painting",
    icon: "🎨",
    default_hours: 6,
    labor_rate: 55,
    materials: 120,
    checklist: ["Protect floors/furniture", "Prep & prime", "Paint coats", "Touch-ups", "Cleanup"],
    estimate_items: [
      { description: "Interior paint (per room)", qty: 1, unit_price: 350 },
      { description: "Materials", qty: 1, unit_price: 120 },
    ],
    invoice_items: [{ description: "Painting service", qty: 1, unit_price: 470 }],
    customer_form: ["Rooms / sq ft", "Color codes", "Furniture move?"],
  },
  {
    id: "junk_removal",
    name: "Junk Removal",
    icon: "🚛",
    default_hours: 2,
    labor_rate: 65,
    materials: 0,
    checklist: ["Confirm items", "Load truck", "Sweep area", "Disposal documentation"],
    estimate_items: [
      { description: "Half load", qty: 1, unit_price: 175 },
      { description: "Full load", qty: 1, unit_price: 325 },
    ],
    invoice_items: [{ description: "Junk removal", qty: 1, unit_price: 175 }],
    customer_form: ["Stairs / access", "Hazardous items?", "Donation preferred?"],
  },
  {
    id: "mobile_detailing",
    name: "Mobile Detailing",
    icon: "🚗",
    default_hours: 2.5,
    labor_rate: 60,
    materials: 35,
    checklist: ["Exterior wash", "Wheels & tires", "Interior vacuum", "Windows", "Final inspection"],
    estimate_items: [
      { description: "Exterior detail", qty: 1, unit_price: 89 },
      { description: "Full detail", qty: 1, unit_price: 179 },
    ],
    invoice_items: [{ description: "Mobile detailing", qty: 1, unit_price: 179 }],
    customer_form: ["Vehicle make/model", "Parking location", "Pet hair?"],
  },
];

export function getTemplate(id) {
  return SERVICE_TEMPLATES.find((t) => t.id === id) || null;
}

export function templateToEstimatorForm(template) {
  if (!template) return null;
  return {
    service_type: template.name,
    hours: template.default_hours,
    labor_rate: template.labor_rate,
    materials: template.materials,
    equipment: 0,
    mileage: 0,
    difficulty: "standard",
    urgency: "normal",
    market_rate_factor: 1,
  };
}
