/**
 * Notification center — inbox with category taxonomy and filters.
 * Real notifications only — no sample/demo seeding.
 */
import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";

const PREFIX = "titanos_notif";
const SEEDED_KEY = "titanos_notif_seeded_v2";
const PURGED_SAMPLES_KEY = "titanos_notif_purged_samples_v1";

/** Drop historically seeded [Sample] rows so the inbox stays real. */
function purgeSampleNotifications(userId) {
  if (!userId) return;
  try {
    if (localStorage.getItem(`${PURGED_SAMPLES_KEY}_${userId}`) === "1") return;
  } catch {
    /* ignore */
  }
  const cleaned = readInbox(userId).filter(
    (n) =>
      !(
        n?.meta?.sample ||
        String(n?.title || "").startsWith("[Sample]") ||
        String(n?.body || "").startsWith("Sample only")
      )
  );
  writeInbox(userId, cleaned);
  try {
    localStorage.setItem(`${PURGED_SAMPLES_KEY}_${userId}`, "1");
    localStorage.removeItem(`${SEEDED_KEY}_${userId}`);
  } catch {
    /* ignore */
  }
}

function isSampleNotification(n) {
  return Boolean(
    n?.meta?.sample ||
      String(n?.title || "").startsWith("[Sample]") ||
      String(n?.body || "").startsWith("Sample only")
  );
}

/** Canonical center categories shown in the UI. */
export const NOTIFICATION_CATEGORIES = [
  {
    id: "jobs",
    label: "Job updates",
    description: "Jobs, hires, estimates, and field activity",
    types: ["jobs", "job", "hires", "applications", "estimates", "booking"],
  },
  {
    id: "messages",
    label: "Messages",
    description: "Chats, replies, and conversation alerts",
    types: ["messages", "message"],
  },
  {
    id: "reviews",
    label: "Reviews",
    description: "Customer ratings and reputation updates",
    types: ["reviews", "review"],
  },
  {
    id: "account",
    label: "Account alerts",
    description: "Payments, billing, security, and profile",
    types: ["account", "payments", "payment", "referrals", "marketplace", "activity", "security"],
  },
  {
    id: "system",
    label: "System updates",
    description: "Product news, maintenance, and platform tips",
    types: ["system", "product", "maintenance"],
  },
];

const TYPE_TO_CATEGORY = (() => {
  const map = {};
  for (const cat of NOTIFICATION_CATEGORIES) {
    for (const t of cat.types) map[t] = cat.id;
  }
  return map;
})();

export function resolveNotificationCategory(notification) {
  if (!notification) return "system";
  const explicit = notification.category || notification.meta?.category;
  if (explicit && NOTIFICATION_CATEGORIES.some((c) => c.id === explicit)) return explicit;
  const type = String(notification.type || "").toLowerCase();
  return TYPE_TO_CATEGORY[type] || "account";
}

export function getCategoryMeta(categoryId) {
  return NOTIFICATION_CATEGORIES.find((c) => c.id === categoryId) || NOTIFICATION_CATEGORIES[4];
}

function normalize(row) {
  if (!row) return row;
  const category = resolveNotificationCategory(row);
  return {
    ...row,
    category,
    type: row.type || category,
    title: row.title || "Notification",
    body: row.body || "",
    link: row.link || "",
    meta: row.meta || {},
    created_at: row.created_at || row.created_date || new Date().toISOString(),
  };
}

function readInbox(userId) {
  return readLocal(PREFIX, userId, "inbox", []).map(normalize);
}

function writeInbox(userId, rows) {
  writeLocal(PREFIX, userId, "inbox", rows.slice(0, 150));
}

export async function ensureNotificationCenter(userId) {
  purgeSampleNotifications(userId);
}

export async function listNotifications(userId, limit = 50, { category = "all", unreadOnly = false } = {}) {
  if (!userId) return [];
  purgeSampleNotifications(userId);

  let rows = [];
  try {
    const remote = await api.entities.Notification.filter({ user_id: userId });
    rows = (remote || []).map(normalize).filter((n) => !isSampleNotification(n));
    const remoteIds = new Set(rows.map((r) => r.id));
    for (const local of readInbox(userId)) {
      if (!remoteIds.has(local.id) && !isSampleNotification(local)) rows.push(local);
    }
  } catch {
    rows = readInbox(userId).filter((n) => !isSampleNotification(n));
  }

  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (category && category !== "all") {
    rows = rows.filter((n) => resolveNotificationCategory(n) === category);
  }
  if (unreadOnly) {
    rows = rows.filter((n) => !n.read_at);
  }

  return rows.slice(0, limit);
}

export async function unreadCount(userId, category = "all") {
  const rows = await listNotifications(userId, 200, { category });
  return rows.filter((n) => !n.read_at).length;
}

export async function categoryCounts(userId) {
  const rows = await listNotifications(userId, 200);
  const counts = { all: rows.length, unread: 0 };
  for (const cat of NOTIFICATION_CATEGORIES) {
    counts[cat.id] = 0;
    counts[`${cat.id}_unread`] = 0;
  }
  for (const n of rows) {
    const cat = resolveNotificationCategory(n);
    counts[cat] = (counts[cat] || 0) + 1;
    if (!n.read_at) {
      counts.unread += 1;
      counts[`${cat}_unread`] = (counts[`${cat}_unread`] || 0) + 1;
    }
  }
  return counts;
}

export async function markRead(userId, notificationId) {
  const now = new Date().toISOString();
  try {
    await api.entities.Notification.update(notificationId, { read_at: now });
  } catch {
    /* local fallback below */
  }
  const rows = readInbox(userId).map((n) =>
    n.id === notificationId ? { ...n, read_at: now } : n
  );
  writeInbox(userId, rows);
}

export async function markAllRead(userId, category = "all") {
  const rows = await listNotifications(userId, 200, { category });
  const unread = rows.filter((n) => !n.read_at);
  if (!unread.length) return;
  const now = new Date().toISOString();
  const ids = unread.map((n) => n.id);
  try {
    await api.entities.Notification.updateMany(ids, { read_at: now });
  } catch {
    /* local fallback below */
  }
  const idSet = new Set(ids);
  writeInbox(
    userId,
    readInbox(userId).map((n) => (idSet.has(n.id) ? { ...n, read_at: now } : n))
  );
}

export async function deleteNotification(userId, notificationId) {
  try {
    await api.entities.Notification.delete(notificationId);
  } catch {
    /* local */
  }
  writeInbox(
    userId,
    readInbox(userId).filter((n) => n.id !== notificationId)
  );
}

export async function pushNotification(userId, { type, title, body, link, meta, category }, prefs = null) {
  if (!userId) return null;
  const resolvedCategory = category || resolveNotificationCategory({ type, meta, category });
  // Prefs may use category id or legacy type key
  if (prefs) {
    if (prefs[resolvedCategory] === false) return null;
    if (type && prefs[type] === false) return null;
  }

  const payload = {
    user_id: userId,
    type: type || resolvedCategory,
    category: resolvedCategory,
    title,
    body: body || "",
    link: link || "",
    meta: { ...(meta || {}), category: resolvedCategory },
    created_by_id: userId,
  };

  try {
    const created = await api.entities.Notification.create(payload);
    return normalize({ ...payload, ...created, created_at: created.created_at || created.created_date });
  } catch {
    const rows = readInbox(userId);
    const row = normalize({
      id: uid(),
      created_at: new Date().toISOString(),
      read_at: null,
      ...payload,
    });
    rows.unshift(row);
    writeInbox(userId, rows);
    return row;
  }
}

/**
 * User activity alert — surfaces across Notification Center + Command Center.
 */
export async function pushActivityUpdate(userId, { title, body, link = "/", meta = {} } = {}, prefs = null) {
  return pushNotification(
    userId,
    {
      type: "activity",
      category: "account",
      title: title || "Activity update",
      body: body || "",
      link,
      meta: { ...meta, activity: true },
    },
    prefs
  );
}
