/**
 * Driver OS 4.0 — Explorer folder registry.
 * Folders lazy-load contents; Mission Control stays outside this tree.
 * `group` mirrors product IA: live | history | analytics | reports | settings
 */

export const FOLDER_GROUPS = Object.freeze([
  { id: "live", label: "Live" },
  { id: "history", label: "History" },
  { id: "analytics", label: "Analytics" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Configuration" },
]);

export const DRIVER_OS_FOLDERS = Object.freeze([
  {
    id: "live-shift",
    label: "Live Shift",
    description: "Active session controls & telemetry",
    premium: false,
    icon: "radio",
    group: "live",
  },
  {
    id: "doordash",
    label: "DoorDash Workflow",
    description: "Guided delivery stages",
    premium: false,
    icon: "package",
    group: "live",
  },
  {
    id: "todays-orders",
    label: "Today's Orders",
    description: "Deliveries completed today",
    premium: false,
    icon: "package",
    group: "history",
  },
  {
    id: "trip-history",
    label: "Trip History",
    description: "Year → month → day archives",
    premium: false,
    icon: "history",
    group: "history",
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Fuel, parking, tolls, logbook",
    premium: false,
    icon: "wallet",
    group: "history",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Driving, stops, revenue, efficiency",
    premium: false,
    icon: "chart",
    group: "analytics",
  },
  {
    id: "rush",
    label: "Rush Intelligence",
    description: "Breakfast through overnight windows",
    premium: false,
    icon: "zap",
    group: "analytics",
  },
  {
    id: "platforms",
    label: "Platform Statistics",
    description: "DoorDash, Uber, Lyft, and more",
    premium: false,
    icon: "layers",
    group: "analytics",
  },
  {
    id: "heatmaps",
    label: "Heat Maps",
    description: "Revenue, tips, ZIP performance",
    premium: false,
    icon: "map",
    group: "analytics",
  },
  {
    id: "performance",
    label: "Performance Score",
    description: "Upload records, calculate profit, compare",
    premium: false,
    icon: "trophy",
    group: "analytics",
  },
  {
    id: "ai",
    label: "AI Insights",
    description: "Titan AI performance observations",
    premium: false,
    icon: "sparkles",
    group: "analytics",
  },
  {
    id: "goals",
    label: "Goals",
    description: "Earnings & hour targets",
    premium: false,
    icon: "target",
    group: "analytics",
  },
  {
    id: "vehicle",
    label: "Vehicle",
    description: "Economics, MPG, true cost",
    premium: false,
    icon: "car",
    group: "analytics",
  },
  {
    id: "tax",
    label: "Tax Center",
    description: "Mileage sync & deduction estimates",
    premium: false,
    icon: "file",
    group: "reports",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Excel / exportable trip reports",
    premium: false,
    icon: "sheet",
    group: "reports",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Reminders & vehicle care",
    premium: false,
    icon: "wrench",
    group: "settings",
  },
  {
    id: "directory",
    label: "Find Drivers",
    description: "Publish or hire nearby",
    premium: false,
    icon: "users",
    group: "settings",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Prefs, GPS, privacy, equipment",
    premium: false,
    icon: "settings",
    group: "settings",
  },
]);

export function folderById(id) {
  return DRIVER_OS_FOLDERS.find((f) => f.id === id) || null;
}

export function foldersByGroup(groupId) {
  return DRIVER_OS_FOLDERS.filter((f) => f.group === groupId);
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
