import { api } from "@/api/apiClient";

/**
 * Create a notification only if the recipient has that preference enabled.
 * Cross-user inserts go through the createNotification API (service role).
 * Same-user inserts can use the entity client under RLS.
 */
export async function notifyUser(userId, { type, title, body, link, meta }, prefs = null) {
  if (!userId) return null;
  if (prefs && prefs[type] === false) return null;

  try {
    let effective = prefs;
    let me = null;
    try {
      me = await api.auth.me();
      if (me?.id === userId) effective = me.notification_prefs;
    } catch {
      /* ignore */
    }
    if (effective && effective[type] === false) return null;

    const payload = {
      user_id: userId,
      type,
      title,
      body: body || "",
      link: link || "",
      meta: meta || {},
    };

    if (me?.id && me.id === userId) {
      return await api.entities.Notification.create({
        ...payload,
        created_by_id: userId,
      });
    }

    const result = await api.functions.invoke("createNotification", payload);
    return result?.data?.notification || result?.notification || null;
  } catch {
    return null;
  }
}
