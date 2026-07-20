/**
 * Dashboard / Command Center preferences — widget order, visibility, favorites, saved items, shortcuts.
 */
const ORDER_KEY = "titanos-cc-widgets";
const HIDDEN_KEY = "titanos-cc-hidden";
const FAVORITES_KEY = "titanos-cc-favorites";
const SAVED_KEY = "titanos-cc-saved";
const SHORTCUTS_KEY = "titanos-cc-shortcuts";

export const DEFAULT_WIDGETS = [
  "analytics",
  "quickActions",
  "recommendations",
  "upcoming",
  "notifications",
  "messages",
  "favorites",
  "saved",
  "attention",
  "activity",
  "timeline",
  "shortcuts",
  "payments",
  "customers",
  "health",
  "weather",
];

/** Widgets that span both columns on large screens */
export const WIDE_WIDGETS = new Set(["analytics", "recommendations"]);

export const WIDGET_META = {
  analytics: { label: "Analytics", description: "Schedule, revenue, and invoice KPIs" },
  quickActions: { label: "Quick actions", description: "Create jobs, estimates, invoices" },
  upcoming: { label: "Upcoming", description: "Today's jobs and coming schedule" },
  messages: { label: "Messages", description: "Recent conversations" },
  notifications: { label: "Notifications", description: "Alerts and updates" },
  recommendations: { label: "Recommendations", description: "Personalized next steps" },
  activity: { label: "Live activity", description: "Community and platform pulse" },
  favorites: { label: "Favorites", description: "Pinned destinations" },
  shortcuts: { label: "Shortcuts", description: "One-tap deep links" },
  saved: { label: "Saved", description: "Bookmarked jobs and items" },
  attention: { label: "Needs attention", description: "Overdue invoices and pending estimates" },
  payments: { label: "Payments", description: "Recent paid invoices" },
  customers: { label: "Customers", description: "People you worked with lately" },
  health: { label: "Titan Score", description: "Trust and reliability score" },
  weather: { label: "Weather", description: "Local conditions for field work" },
  timeline: { label: "Recent activity", description: "Jobs, estimates, and invoices" },
};

/** Legacy id → new id */
const LEGACY_MAP = {
  kpis: "analytics",
  schedule: "upcoming",
  ai: "recommendations",
  actions: "quickActions",
};

const DEFAULT_FAVORITES = [
  { id: "jobs", label: "Jobs", path: "/jobs" },
  { id: "customers", label: "Customers", path: "/customers" },
  { id: "invoices", label: "Invoices", path: "/invoices" },
  { id: "driver", label: "Driver Hub", path: "/driver" },
  { id: "assistant", label: "Titan AI", path: "/assistant" },
];

const DEFAULT_SHORTCUTS = [
  { id: "est", label: "New estimate", path: "/estimates?new=1" },
  { id: "job", label: "New job", path: "/jobs?new=1" },
  { id: "inv", label: "New invoice", path: "/invoices?new=1" },
  { id: "sched", label: "Schedule", path: "/schedule" },
  { id: "pay", label: "Payments", path: "/payments" },
  { id: "driver", label: "Find drivers", path: "/driver?tab=directory" },
  { id: "tax", label: "Tax Center", path: "/tax-center" },
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadWidgetOrder() {
  const raw = readJson(ORDER_KEY, null);
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_WIDGETS];
  const mapped = raw.map((id) => LEGACY_MAP[id] || id);
  const seen = new Set();
  const order = [];
  for (const id of mapped) {
    if (DEFAULT_WIDGETS.includes(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of DEFAULT_WIDGETS) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

export function saveWidgetOrder(order) {
  writeJson(ORDER_KEY, order);
}

export function loadHiddenWidgets() {
  const raw = readJson(HIDDEN_KEY, []);
  return Array.isArray(raw) ? raw.filter((id) => DEFAULT_WIDGETS.includes(id)) : [];
}

export function saveHiddenWidgets(ids) {
  writeJson(HIDDEN_KEY, ids);
}

export function toggleWidgetVisibility(hidden, id) {
  const set = new Set(hidden);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const next = [...set];
  saveHiddenWidgets(next);
  return next;
}

/** Restore default order and show all widgets */
export function resetWidgetLayout() {
  const order = [...DEFAULT_WIDGETS];
  saveWidgetOrder(order);
  saveHiddenWidgets([]);
  return { order, hidden: [] };
}

export function loadFavorites() {
  const rows = readJson(FAVORITES_KEY, null);
  return Array.isArray(rows) && rows.length ? rows : [...DEFAULT_FAVORITES];
}

export function saveFavorites(rows) {
  writeJson(FAVORITES_KEY, rows);
}

export function toggleFavorite(item) {
  const cur = loadFavorites();
  const exists = cur.some((f) => f.path === item.path);
  const next = exists ? cur.filter((f) => f.path !== item.path) : [...cur, item].slice(0, 12);
  saveFavorites(next);
  return next;
}

export function loadSavedItems() {
  return readJson(SAVED_KEY, []);
}

export function saveSavedItems(rows) {
  writeJson(SAVED_KEY, rows);
}

export function addSavedItem(item) {
  const cur = loadSavedItems();
  if (cur.some((s) => s.id === item.id)) return cur;
  const next = [{ ...item, savedAt: new Date().toISOString() }, ...cur].slice(0, 20);
  saveSavedItems(next);
  return next;
}

export function removeSavedItem(id) {
  const next = loadSavedItems().filter((s) => s.id !== id);
  saveSavedItems(next);
  return next;
}

export function loadShortcuts() {
  const rows = readJson(SHORTCUTS_KEY, null);
  return Array.isArray(rows) && rows.length ? rows : [...DEFAULT_SHORTCUTS];
}

export function saveShortcuts(rows) {
  writeJson(SHORTCUTS_KEY, rows);
}

export function moveWidget(order, sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return order;
  const next = [...order];
  const from = next.indexOf(sourceId);
  const to = next.indexOf(targetId);
  if (from < 0 || to < 0) return order;
  next.splice(from, 1);
  next.splice(to, 0, sourceId);
  return next;
}

export function moveWidgetBy(order, id, delta) {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const to = Math.max(0, Math.min(order.length - 1, from + delta));
  if (to === from) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
