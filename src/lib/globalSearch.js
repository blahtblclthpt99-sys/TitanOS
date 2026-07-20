/**
 * Intelligent global search — autocomplete, history, saved, fuzzy, suggestions.
 */
import { APP_NAV_ITEMS, QUICK_CREATE_ACTIONS } from "@/lib/nav-items";
import { editDistance, fuzzyMatch, listDrivers } from "@/lib/driverDirectoryApi";
import { searchConversationsSync } from "@/lib/messagesApi";
import { getSearchAssistance, getSearchAutocomplete } from "@/lib/aiInsights";

const RECENT_KEY = "titanos_search_recent";
const SAVED_KEY = "titanos_search_saved";

const SUGGESTIONS = [
  "Jobs today",
  "Overdue invoices",
  "Create estimate",
  "Find CDL drivers",
  "Tax Center",
  "Customers",
  "Schedule",
  "Ask Titan AI",
];

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows.slice(0, 20)));
  } catch {
    /* ignore */
  }
}

export function getRecentSearches() {
  return readList(RECENT_KEY);
}

export function pushRecentSearch(query) {
  const q = String(query || "").trim();
  if (!q) return getRecentSearches();
  const next = [q, ...getRecentSearches().filter((x) => x.toLowerCase() !== q.toLowerCase())];
  writeList(RECENT_KEY, next);
  return next;
}

export function clearRecentSearches() {
  writeList(RECENT_KEY, []);
}

export function getSavedSearches() {
  return readList(SAVED_KEY);
}

export function toggleSavedSearch(query) {
  const q = String(query || "").trim();
  if (!q) return getSavedSearches();
  const cur = getSavedSearches();
  const exists = cur.some((x) => x.toLowerCase() === q.toLowerCase());
  const next = exists
    ? cur.filter((x) => x.toLowerCase() !== q.toLowerCase())
    : [q, ...cur];
  writeList(SAVED_KEY, next);
  return next;
}

export function isSearchSaved(query) {
  const q = String(query || "").trim().toLowerCase();
  return getSavedSearches().some((x) => x.toLowerCase() === q);
}

export function getSuggestedSearches(query = "") {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return SUGGESTIONS.slice(0, 6);
  return SUGGESTIONS.filter((s) => fuzzyMatch(s, q) || s.toLowerCase().includes(q)).slice(0, 6);
}

/** AI-assisted autocomplete chips for the search box */
export function getAutocompleteSuggestions(query = "") {
  return getSearchAutocomplete(query);
}

function scoreLabel(label, query) {
  const l = String(label).toLowerCase();
  const q = String(query).toLowerCase().trim();
  if (!q) return 0;
  if (l === q) return 100;
  if (l.startsWith(q)) return 80;
  if (l.includes(q)) return 60;
  const words = l.split(/\s+/);
  let best = 0;
  for (const w of words) {
    const d = editDistance(w, q);
    if (d <= 1) best = Math.max(best, 50);
    else if (d <= 2 && q.length > 4) best = Math.max(best, 35);
  }
  return best;
}

/**
 * @param {string} query
 * @param {{ userId?: string }} [options]
 * @returns {{ id: string, label: string, hint: string, path: string, icon?: any, group: string, score: number }[]}
 */
export function runGlobalSearch(query, options = {}) {
  const q = String(query || "").trim();
  const results = [];

  for (const item of APP_NAV_ITEMS) {
    const score = q
      ? Math.max(scoreLabel(item.label, q), scoreLabel(item.path, q), scoreLabel(item.group, q) * 0.4)
      : 10;
    if (!q || score >= 30 || fuzzyMatch(item.label, q)) {
      results.push({
        id: `nav-${item.path}`,
        label: item.label,
        hint: item.group || "Page",
        path: item.path,
        icon: item.icon,
        group: "Pages",
        score: q ? score : 10,
      });
    }
  }

  for (const action of QUICK_CREATE_ACTIONS) {
    const score = q ? scoreLabel(action.label, q) : 8;
    if (!q || score >= 30 || fuzzyMatch(action.label, q)) {
      results.push({
        id: `act-${action.path}`,
        label: action.label,
        hint: "Quick create",
        path: action.path,
        icon: action.icon,
        group: "Actions",
        score: q ? score + 5 : 8,
      });
    }
  }

  // Intent shortcuts
  const intents = [
    { re: /invoice|bill|overdue/i, label: "Invoices", path: "/invoices", hint: "Billing" },
    { re: /estimate|quote/i, label: "Estimates", path: "/estimates", hint: "Quotes" },
    { re: /driver|cdl|truck|van|otr|hazmat/i, label: "Find drivers", path: "/driver", hint: "Driver Hub" },
    { re: /tax|1099|mileage/i, label: "Tax Center", path: "/tax-center", hint: "Taxes" },
    { re: /ai|assistant|help/i, label: "Titan AI", path: "/assistant", hint: "Ask Titan" },
    { re: /message|chat|inbox|dm/i, label: "Messages", path: "/messages", hint: "Inbox" },
  ];
  if (q) {
    for (const intent of intents) {
      if (intent.re.test(q)) {
        results.push({
          id: `intent-${intent.path}`,
          label: intent.label,
          hint: intent.hint,
          path: intent.path,
          group: "AI recommendations",
          score: 90,
        });
      }
    }
  }

  try {
    const drivers = listDrivers();
    for (const d of drivers) {
      const blob = `${d.name} ${d.vehicleType} ${d.licenseClass} ${d.city}`;
      const score = q ? Math.max(scoreLabel(d.name, q), scoreLabel(blob, q) * 0.5) : 0;
      if (q && (score >= 30 || fuzzyMatch(blob, q))) {
        results.push({
          id: `drv-${d.id}`,
          label: d.name,
          hint: `${d.vehicleType} · ${d.city}`,
          path: `/driver/${d.id}`,
          group: "Drivers",
          score,
        });
      }
    }
  } catch {
    /* ignore */
  }

  if (q && options.userId) {
    try {
      for (const hit of searchConversationsSync(options.userId, q)) {
        results.push(hit);
      }
    } catch {
      /* ignore */
    }
  }

  // Dedupe by path+label, sort by score
  const seen = new Set();
  return results
    .filter((r) => {
      const key = `${r.path}|${r.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, q ? 12 : 8);
}

export function getAiSearchTips(query) {
  const assist = getSearchAssistance(query);
  const tips = [assist.tip];
  const q = String(query || "").toLowerCase();
  if (/driver|truck|cdl|van/.test(q)) tips.push("Open Driver Hub → Find Drivers to filter by CDL, van, or OTR.");
  if (/invoice|pay/.test(q)) tips.push("Check Invoices for overdue balances and send reminders.");
  if (/job|schedule/.test(q)) tips.push("Jump to Jobs or Schedule to manage today's work.");
  if (/message|chat|inbox/.test(q)) tips.push("Open Messages to search conversations, send photos, or voice notes.");
  return tips.slice(0, 3);
}
