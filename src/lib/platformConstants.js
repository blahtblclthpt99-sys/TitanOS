/** Shared categories for Marketplace, Hire, Community, Estimator. */
export const SERVICE_CATEGORIES = [
  "General",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Landscaping",
  "Lawn Care",
  "Pressure Washing",
  "Cleaning",
  "Roofing",
  "Flooring",
  "Painting",
  "Pest Control",
  "Handyman",
  "Moving",
  "Other",
];

export const EXPENSE_CATEGORIES = [
  { id: "fuel", label: "Fuel" },
  { id: "vehicle", label: "Vehicle maintenance" },
  { id: "equipment", label: "Equipment" },
  { id: "supplies", label: "Supplies" },
  { id: "insurance", label: "Insurance" },
  { id: "advertising", label: "Advertising" },
  { id: "office", label: "Office expenses" },
  { id: "meals", label: "Meals" },
  { id: "travel", label: "Travel" },
  { id: "software", label: "Software" },
  { id: "utilities", label: "Utilities" },
  { id: "other", label: "Other deductions" },
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
  "WI","WY","DC",
];

export function locationLabel(city, state) {
  if (city && state) return `${city}, ${state}`;
  return city || state || "";
}

export function timeAgo(dateStr) {
  const t = new Date(dateStr).getTime();
  if (!t) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function makeReferralCode(seed = "") {
  const base = (seed || Math.random().toString(36)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TITAN${base}${tail}`.slice(0, 12);
}
