import { api } from "@/api/apiClient";

/**
 * Create a notification only if the recipient has that preference enabled.
 * Falls back to sending when prefs are missing (default-on).
 */
export async function notifyUser(userId, { type, title, body, link, meta }, prefs = null) {
  if (!userId) return null;
  if (prefs && prefs[type] === false) return null;

  try {
    // Best-effort: load prefs from profile if not provided
    let effective = prefs;
    if (!effective) {
      try {
        const me = await api.auth.me();
        if (me?.id === userId) effective = me.notification_prefs;
      } catch {
        /* ignore */
      }
    }
    if (effective && effective[type] === false) return null;

    return await api.entities.Notification.create({
      user_id: userId,
      type,
      title,
      body: body || "",
      link: link || "",
      meta: meta || {},
      created_by_id: userId,
    });
  } catch {
    return null;
  }
}
