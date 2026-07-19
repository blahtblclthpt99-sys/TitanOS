import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";

const PREFIX = "titanos_notif";

export async function listNotifications(userId, limit = 50) {
  if (!userId) return [];
  try {
    const rows = await api.entities.Notification.filter({ user_id: userId });
    return rows
      .sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date))
      .slice(0, limit);
  } catch {
    return readLocal(PREFIX, userId, "inbox", []).slice(0, limit);
  }
}

export async function unreadCount(userId) {
  const rows = await listNotifications(userId);
  return rows.filter((n) => !n.read_at).length;
}

export async function markRead(userId, notificationId) {
  try {
    await api.entities.Notification.update(notificationId, { read_at: new Date().toISOString() });
  } catch {
    const rows = readLocal(PREFIX, userId, "inbox", []);
    const next = rows.map((n) =>
      n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
    );
    writeLocal(PREFIX, userId, "inbox", next);
  }
}

export async function markAllRead(userId) {
  const rows = await listNotifications(userId);
  await Promise.all(rows.filter((n) => !n.read_at).map((n) => markRead(userId, n.id)));
}

export async function deleteNotification(userId, notificationId) {
  try {
    await api.entities.Notification.delete(notificationId);
  } catch {
    writeLocal(
      PREFIX,
      userId,
      "inbox",
      readLocal(PREFIX, userId, "inbox", []).filter((n) => n.id !== notificationId)
    );
  }
}

export async function pushNotification(userId, { type, title, body, link, meta }, prefs = null) {
  if (!userId || (prefs && prefs[type] === false)) return null;
  const payload = {
    user_id: userId,
    type,
    title,
    body: body || "",
    link: link || "",
    meta: meta || {},
    created_by_id: userId,
  };
  try {
    return await api.entities.Notification.create(payload);
  } catch {
    const rows = readLocal(PREFIX, userId, "inbox", []);
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    rows.unshift(row);
    writeLocal(PREFIX, userId, "inbox", rows.slice(0, 100));
    return row;
  }
}
