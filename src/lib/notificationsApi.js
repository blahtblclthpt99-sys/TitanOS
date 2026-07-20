/**
 * Notification center — inbox with category taxonomy, seed, filters.
 *
 * Categories:
 * - jobs      Job updates
 * - messages  Messages
 * - reviews   Reviews
 * - account   Account alerts
 * - system    System updates
 */
import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";

const PREFIX = "titanos_notif";
const SEEDED_KEY = "titanos_notif_seeded_v2";

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

function seedDemoNotifications(userId) {
  if (!userId) return;
  try {
    if (localStorage.getItem(`${SEEDED_KEY}_${userId}`) === "1") return;
  } catch {
    /* ignore */
  }
  const existing = readInbox(userId);
  if (existing.length > 0) {
    try {
      localStorage.setItem(`${SEEDED_KEY}_${userId}`, "1");
    } catch {
      /* ignore */
    }
    return;
  }

  const now = Date.now();
  const demo = [
    {
      id: uid(),
      user_id: userId,
      type: "jobs",
      category: "jobs",
      title: "Job status updated",
      body: "HVAC tune-up for Rivera Residence moved to In progress.",
      link: "/jobs",
      read_at: null,
      created_at: new Date(now - 12 * 60 * 1000).toISOString(),
      meta: {},
    },
    {
      id: uid(),
      user_id: userId,
      type: "jobs",
      category: "jobs",
      title: "New hire application",
      body: "A worker applied to your open help request.",
      link: "/hire",
      read_at: null,
      created_at: new Date(now - 55 * 60 * 1000).toISOString(),
      meta: {},
    },
    {
      id: uid(),
      user_id: userId,
      type: "messages",
      category: "messages",
      title: "New message",
      body: "Titan Support sent you a welcome message.",
      link: "/messages",
      read_at: null,
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      meta: {},
    },
    {
      id: uid(),
      user_id: userId,
      type: "activity",
      category: "account",
      title: "Activity update",
      body: "Marcus Rivera updated availability to Available in Driver Hub.",
      link: "/driver",
      read_at: null,
      created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      meta: { activity: true },
    },
    {
      id: uid(),
      user_id: userId,
      type: "reviews",
      category: "reviews",
      title: "New 5-star review",
      body: "A customer rated your last completed job.",
      link: "/reputation",
      read_at: null,
      created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      meta: {},
    },
    {
      id: uid(),
      user_id: userId,
      type: "account",
      category: "account",
      title: "Payment received",
      body: "Invoice #1042 was paid in full.",
      link: "/payments",
      read_at: null,
      created_at: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
      meta: {},
    },
    {
      id: uid(),
      user_id: userId,
      type: "account",
      category: "account",
      title: "Security reminder",
      body: "Review your notification and privacy preferences in Settings.",
      link: "/settings",
      read_at: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
      meta: {},
    },
    {
      id: uid(),
      user_id: userId,
      type: "system",
      category: "system",
      title: "TitanOS update",
      body: "Messages now support photos, files, voice notes, and read receipts.",
      link: "/messages",
      read_at: null,
      created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      meta: {},
    },
    {
      id: uid(),
      user_id: userId,
      type: "system",
      category: "system",
      title: "Scheduled maintenance",
      body: "Brief platform maintenance Sunday 2–3 AM CT. No action needed.",
      link: "/notifications",
      read_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      meta: {},
    },
  ];

  writeInbox(userId, demo);
  try {
    localStorage.setItem(`${SEEDED_KEY}_${userId}`, "1");
  } catch {
    /* ignore */
  }
}

export async function ensureNotificationCenter(userId) {
  seedDemoNotifications(userId);
}

export async function listNotifications(userId, limit = 50, { category = "all", unreadOnly = false } = {}) {
  if (!userId) return [];
  seedDemoNotifications(userId);

  let rows = [];
  try {
    const remote = await api.entities.Notification.filter({ user_id: userId });
    rows = (remote || []).map(normalize);
    // Merge any local-only rows (e.g. demo / offline) by id
    const remoteIds = new Set(rows.map((r) => r.id));
    for (const local of readInbox(userId)) {
      if (!remoteIds.has(local.id)) rows.push(local);
    }
  } catch {
    rows = readInbox(userId);
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
  await Promise.all(rows.filter((n) => !n.read_at).map((n) => markRead(userId, n.id)));
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
