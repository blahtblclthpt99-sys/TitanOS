/**
 * Driver OS 4.0 — Explorer folder registry.
 * Folders lazy-load contents; Mission Control stays outside this tree.
 */

export const DRIVER_OS_FOLDERS = Object.freeze([
  {
    id: "live-shift",
    label: "Live Shift",
    description: "Active session controls & telemetry",
    premium: false,
    icon: "radio",
  },
  {
    id: "todays-orders",
    label: "Today's Orders",
    description: "Deliveries completed today",
    premium: false,
    icon: "package",
  },
  {
    id: "trip-history",
    label: "Trip History",
    description: "Year → month → day archives",
    premium: false,
    icon: "history",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Driving, stops, revenue, efficiency",
    premium: true,
    icon: "chart",
  },
  {
    id: "rush",
    label: "Rush Intelligence",
    description: "Breakfast through overnight windows",
    premium: true,
    icon: "zap",
  },
  {
    id: "platforms",
    label: "Platform Statistics",
    description: "DoorDash, Uber, Lyft, and more",
    premium: true,
    icon: "layers",
  },
  {
    id: "heatmaps",
    label: "Heat Maps",
    description: "Revenue, tips, ZIP performance",
    premium: true,
    icon: "map",
  },
  {
    id: "vehicle",
    label: "Vehicle",
    description: "Economics, MPG, true cost",
    premium: true,
    icon: "car",
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Fuel, parking, tolls, logbook",
    premium: true,
    icon: "wallet",
  },
  {
    id: "tax",
    label: "Tax Center",
    description: "Mileage sync & deduction estimates",
    premium: false,
    icon: "file",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Excel / exportable trip reports",
    premium: true,
    icon: "sheet",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Prefs, GPS, privacy, equipment",
    premium: false,
    icon: "settings",
  },
  {
    id: "ai",
    label: "AI Insights",
    description: "Titan AI performance observations",
    premium: true,
    icon: "sparkles",
  },
  {
    id: "performance",
    label: "Performance",
    description: "Daily score & trends",
    premium: true,
    icon: "trophy",
  },
  {
    id: "goals",
    label: "Goals",
    description: "Earnings & hour targets",
    premium: true,
    icon: "target",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Reminders & vehicle care",
    premium: true,
    icon: "wrench",
  },
  {
    id: "directory",
    label: "Find Drivers",
    description: "Publish or hire nearby",
    premium: false,
    icon: "users",
  },
  {
    id: "doordash",
    label: "DoorDash Workflow",
    description: "Guided delivery stages",
    premium: true,
    icon: "package",
  },
]);

export function folderById(id) {
  return DRIVER_OS_FOLDERS.find((f) => f.id === id) || null;
}

/** Modular platform registry for Platform Statistics folders. */
export const PLATFORMS = Object.freeze([
  { id: "doordash", label: "DoorDash" },
  { id: "uber_eats", label: "Uber Eats" },
  { id: "uber", label: "Uber Driver" },
  { id: "lyft", label: "Lyft" },
  { id: "spark", label: "Spark" },
  { id: "roadie", label: "Roadie" },
  { id: "amazon_flex", label: "Amazon Flex" },
  { id: "instacart", label: "Instacart" },
  { id: "grubhub", label: "Grubhub" },
  { id: "shipt", label: "Shipt" },
  { id: "personal", label: "Personal" },
]);
