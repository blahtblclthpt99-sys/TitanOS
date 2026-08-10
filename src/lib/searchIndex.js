/**
 * Instant local search index — in-memory + localStorage snapshot.
 * Global search reads sync; warm/prefetch writes async in the background.
 */
import { editDistance, fuzzyMatch } from "@/lib/driverDirectoryApi";
import { searchDeliveries } from "@/lib/driverOs/search";
import { listAiConversationDocs } from "@/lib/aiConversationStore";
import { listVoiceTranscriptDocs } from "@/lib/voiceTranscriptStore";

const STORAGE_PREFIX = "titanos_search_index_v1";
const MAX_DOCS = 2500;
const MAX_PERSIST = 1200;

/** @type {Map<string, SearchDoc>} */
let memory = new Map();
let loadedUserId = null;
/** @type {string | null} */
let activeUserId = null;

/**
 * @typedef {{
 *   id: string,
 *   group: string,
 *   label: string,
 *   hint?: string,
 *   path: string,
 *   haystack: string,
 *   boost?: number,
 *   updatedAt?: number,
 * }} SearchDoc
 */

export const SETTINGS_SEARCH_CATALOG = Object.freeze(
  // Built from settingsCatalog panels — keep global search in sync
  [
    { id: "profile", title: "Profile", description: "Name and account details", path: "/settings?panel=profile" },
    { id: "pro-profile", title: "Professional profile", description: "Bio, portfolio, skills", path: "/profile" },
    { id: "company", title: "Company", description: "Business name, address, branding", path: "/settings?panel=company" },
    { id: "notifications", title: "Notifications", description: "Job, message, review alerts", path: "/settings?panel=notifications" },
    { id: "marketing", title: "Marketing preferences", description: "Email, SMS, push", path: "/settings?panel=marketing" },
    { id: "trust", title: "Trust & Safety", description: "Report, block, verification", path: "/trust-safety" },
    { id: "privacy", title: "Privacy", description: "Visibility and sharing", path: "/settings?panel=privacy" },
    { id: "security", title: "Security", description: "Password and login", path: "/settings?panel=security" },
    { id: "accounts", title: "Connected accounts", description: "Google and email sign-in", path: "/settings?panel=accounts" },
    { id: "theme", title: "Appearance", description: "Theme, contrast, text size, motion", path: "/settings?panel=theme" },
  ]
);

export const ANALYTICS_SEARCH_CATALOG = Object.freeze([
  { id: "activity", title: "Activity", description: "Jobs and schedule trends", path: "/analytics#activity" },
  { id: "revenue", title: "Revenue", description: "Paid invoices and growth", path: "/analytics#revenue" },
  { id: "customers", title: "Customer growth", description: "New customers this month", path: "/analytics#customers" },
  { id: "performance", title: "Performance", description: "Completion and engagement", path: "/analytics#performance" },
  { id: "reports", title: "Reports", description: "Financial deep-dives", path: "/reports" },
  { id: "finances", title: "Finances", description: "Profit and loss", path: "/finances" },
  { id: "tax", title: "Tax Center", description: "Mileage and deductions", path: "/tax-center" },
]);

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId || "anon"}`;
}

function customerName(c) {
  if (!c) return "";
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.company_name || c.email || "Customer";
}

function scoreHay(haystack, label, query) {
  const h = String(haystack || "").toLowerCase();
  const l = String(label || "").toLowerCase();
  const q = String(query || "").toLowerCase().trim();
  if (!q) return 0;
  if (l === q) return 100;
  if (l.startsWith(q)) return 88;
  if (l.includes(q)) return 72;
  if (h.includes(q)) return 58;
  const words = l.split(/\s+/);
  let best = 0;
  for (const w of words) {
    if (Math.abs(w.length - q.length) > 2) continue;
    const d = editDistance(w, q);
    if (d <= 1) best = Math.max(best, 48);
    else if (d <= 2 && q.length > 4) best = Math.max(best, 34);
  }
  if (fuzzyMatch(l, q) || fuzzyMatch(h, q)) best = Math.max(best, 40);
  return best;
}

function persist(userId) {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    const rows = [...memory.values()]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, MAX_PERSIST);
    localStorage.setItem(storageKey(userId), JSON.stringify(rows));
  } catch {
    /* quota */
  }
}

function hydrate(userId) {
  if (!userId || typeof localStorage === "undefined") return;
  if (loadedUserId === userId && memory.size) return;
  memory = new Map();
  loadedUserId = userId;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      for (const doc of parsed) {
        if (doc?.id) memory.set(doc.id, doc);
      }
    }
  } catch {
    memory = new Map();
  }
  ensureStaticCatalogs();
}

function ensureStaticCatalogs() {
  for (const s of SETTINGS_SEARCH_CATALOG) {
    memory.set(`settings-${s.id}`, {
      id: `settings-${s.id}`,
      group: "Settings",
      label: s.title,
      hint: s.description,
      path: s.path,
      haystack: `${s.title} ${s.description} settings`,
      boost: 4,
      updatedAt: 0,
    });
  }
  for (const a of ANALYTICS_SEARCH_CATALOG) {
    memory.set(`analytics-${a.id}`, {
      id: `analytics-${a.id}`,
      group: "Analytics",
      label: a.title,
      hint: a.description,
      path: a.path,
      haystack: `${a.title} ${a.description} analytics metrics`,
      boost: 3,
      updatedAt: 0,
    });
  }
}

/** Upsert docs into the live index (sync). */
export function upsertSearchDocs(userId, docs) {
  if (!userId || !Array.isArray(docs) || !docs.length) return;
  hydrate(userId);
  const now = Date.now();
  for (const doc of docs) {
    if (!doc?.id) continue;
    memory.set(doc.id, { ...doc, updatedAt: now });
  }
  while (memory.size > MAX_DOCS) {
    const oldest = [...memory.values()].sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))[0];
    if (!oldest) break;
    memory.delete(oldest.id);
  }
  persist(userId);
}

export function removeSearchDocsByPrefix(userId, prefix) {
  if (!userId || !prefix) return;
  hydrate(userId);
  for (const id of [...memory.keys()]) {
    if (id.startsWith(prefix)) memory.delete(id);
  }
  persist(userId);
}

export function docsFromJobs(jobs = []) {
  return jobs.map((j) => {
    const label = j.title || j.service_type || "Job";
    const hint = [j.customer_name, j.status, j.scheduled_date].filter(Boolean).join(" · ");
    return {
      id: `job-${j.id}`,
      group: "Jobs",
      label,
      hint,
      path: `/jobs?id=${encodeURIComponent(j.id)}`,
      haystack: `${label} ${hint} ${j.address || ""} ${j.description || ""} ${j.id} job`,
      boost: 8,
    };
  });
}

export function docsFromCustomers(customers = []) {
  return customers.map((c) => {
    const label = customerName(c);
    const hint = [c.email, c.phone, c.company_name].filter(Boolean).join(" · ");
    return {
      id: `customer-${c.id}`,
      group: "Customers",
      label,
      hint: hint || "Customer",
      path: `/customers/${encodeURIComponent(c.id)}`,
      haystack: `${label} ${hint} ${c.notes || ""} customer`,
      boost: 8,
    };
  });
}

export function docsFromInvoices(invoices = []) {
  return invoices.map((inv) => {
    const num = inv.invoice_number || inv.id;
    const label = `Invoice ${num}`;
    const hint = [inv.customer_name, inv.status, inv.total != null ? `$${inv.total}` : null]
      .filter(Boolean)
      .join(" · ");
    return {
      id: `invoice-${inv.id}`,
      group: "Invoices",
      label,
      hint,
      path: `/invoices?id=${encodeURIComponent(inv.id)}`,
      haystack: `${label} ${hint} ${inv.id} invoice bill`,
      boost: 8,
    };
  });
}

export function docsFromExpenses(expenses = []) {
  return (expenses || [])
    .filter((e) => e.receipt_url || e.receipt_name || e.file_name || e.file_url)
    .map((e) => {
      const fileName =
        e.receipt_name ||
        String(e.receipt_url || e.file_url || "")
          .split("/")
          .pop() ||
        e.vendor ||
        "Receipt";
      const hint = [e.vendor, e.category, e.date].filter(Boolean).join(" · ");
      return {
        id: `expense-file-${e.id}`,
        group: "Files",
        label: fileName,
        hint: hint ? `Receipt · ${hint}` : "Receipt",
        path: "/receipts",
        haystack: `${fileName} ${hint} receipt expense file`,
        boost: 5,
      };
    });
}

export function docsFromCustomerFiles(files = []) {
  return (files || []).map((f) => {
    const label = f.name || f.file_name || f.title || "File";
    const hint = f.customer_name || f.mime_type || "Customer file";
    return {
      id: `file-${f.id}`,
      group: "Files",
      label,
      hint,
      path: f.customer_id ? `/customers/${encodeURIComponent(f.customer_id)}` : "/customers",
      haystack: `${label} ${hint} file document attachment`,
      boost: 6,
    };
  });
}

export function docsFromTrips(userId, query) {
  if (!userId || !query) return [];
  return searchDeliveries(userId, query).map((hit) => ({
    id: `trip-${hit.id}`,
    group: "Trips",
    label: hit.title,
    hint: hit.subtitle || hit.kind,
    path: `/driver?folder=${encodeURIComponent(hit.folder || "trip-history")}&q=${encodeURIComponent(query)}`,
    haystack: `${hit.title} ${hit.subtitle || ""} ${hit.kind} trip delivery shift`,
    boost: 7,
    _liveScore: true,
  }));
}

/** Ingest entity list rows into the index (called from fetchEntity). */
export function ingestEntityRows(entityName, rows) {
  if (!Array.isArray(rows) || !rows.length) return;
  const userId = activeUserId || loadedUserId;
  if (!userId) return;

  if (entityName === "Job") upsertSearchDocs(userId, docsFromJobs(rows));
  else if (entityName === "Customer") upsertSearchDocs(userId, docsFromCustomers(rows));
  else if (entityName === "Invoice") upsertSearchDocs(userId, docsFromInvoices(rows));
  else if (entityName === "Expense") upsertSearchDocs(userId, docsFromExpenses(rows));
  else if (entityName === "CustomerFile") upsertSearchDocs(userId, docsFromCustomerFiles(rows));
}

export function setSearchIndexUser(userId) {
  activeUserId = userId || null;
  if (userId) hydrate(userId);
}

/**
 * Sync query against the local index (+ live trip / AI / voice docs).
 * @returns {SearchDoc & { score: number }[]}
 */
export function querySearchIndex(userId, query, { limit = 20 } = {}) {
  const q = String(query || "").trim();
  if (!userId || !q) return [];
  hydrate(userId);
  ensureStaticCatalogs();

  // Merge ephemeral stores without persisting on every keystroke
  const docs = new Map(memory);
  for (const d of listAiConversationDocs(userId)) docs.set(d.id, d);
  for (const d of listVoiceTranscriptDocs(userId)) docs.set(d.id, d);

  const hits = [];
  for (const doc of docs.values()) {
    const score = scoreHay(doc.haystack, doc.label, q) + (doc.boost || 0);
    // scoreHay already performs fuzzy matching. Re-running it here multiplies
    // Levenshtein work for every non-match in large local indexes.
    if (score >= 34) {
      hits.push({
        id: doc.id,
        label: doc.label,
        hint: doc.hint || doc.group,
        path: doc.path,
        group: doc.group,
        score,
      });
    }
  }

  // Trips are computed live from driver stores (already local/sync)
  for (const trip of docsFromTrips(userId, q)) {
    const score = scoreHay(trip.haystack, trip.label, q) + (trip.boost || 0);
    if (score >= 34) {
      hits.push({
        id: trip.id,
        label: trip.label,
        hint: trip.hint,
        path: trip.path,
        group: "Trips",
        score,
      });
    }
  }

  const seen = new Set();
  return hits
    .filter((h) => {
      const key = `${h.group}|${h.path}|${h.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Background warm — fills Jobs / Customers / Invoices / Files without blocking UI. */
export async function warmSearchIndex(userId) {
  if (!userId) return;
  setSearchIndexUser(userId);
  hydrate(userId);
  ensureStaticCatalogs();
  upsertSearchDocs(userId, listAiConversationDocs(userId));
  upsertSearchDocs(userId, listVoiceTranscriptDocs(userId));

  try {
    const { api } = await import("@/api/apiClient");
    const [jobs, customers, invoices, expenses, files] = await Promise.all([
      api.entities.Job.list("-scheduled_date", 120).catch(() => []),
      api.entities.Customer.list("-created_date", 120).catch(() => []),
      api.entities.Invoice.list("-created_date", 120).catch(() => []),
      api.entities.Expense.list("-date", 80).catch(() => []),
      api.entities.CustomerFile?.list
        ? api.entities.CustomerFile.list("-created_date", 80).catch(() => [])
        : Promise.resolve([]),
    ]);
    upsertSearchDocs(userId, [
      ...docsFromJobs(jobs),
      ...docsFromCustomers(customers),
      ...docsFromInvoices(invoices),
      ...docsFromExpenses(expenses),
      ...docsFromCustomerFiles(files),
    ]);
  } catch {
    /* offline / RLS — keep persisted snapshot */
  }
}
