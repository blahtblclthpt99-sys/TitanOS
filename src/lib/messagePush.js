/**
 * Browser / OS notification hooks for new messages.
 * Uses the Web Notifications API (works on web + Capacitor WebView when permitted).
 */

const PERM_ASKED_KEY = "titanos_msg_push_asked";

export function getMessagePushPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestMessagePushPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    const result = await Notification.requestPermission();
    try {
      localStorage.setItem(PERM_ASKED_KEY, "1");
    } catch {
      /* ignore */
    }
    return result;
  } catch {
    return Notification.permission;
  }
}

export function hasAskedMessagePush() {
  try {
    return localStorage.getItem(PERM_ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Show a system notification when a message arrives (best-effort).
 * Skips when the Messages page is focused and visible.
 */
export function showMessagePush({ title, body, threadId, href } = {}) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && !document.hidden) {
    const path = typeof window !== "undefined" ? window.location?.pathname || "" : "";
    if (path.startsWith("/messages") || path.startsWith("/comms")) return;
  }

  const target =
    href ||
    (threadId?.startsWith("comms-")
      ? `/comms?channel=${encodeURIComponent(threadId.slice("comms-".length))}`
      : threadId
        ? `/messages?thread=${encodeURIComponent(threadId)}`
        : "/messages");

  try {
    const n = new Notification(title || "New message", {
      body: body || "",
      tag: threadId ? `titan-msg-${threadId}` : "titan-msg",
      renotify: true,
    });
    n.onclick = () => {
      try {
        window.focus();
        window.location.assign(target);
      } catch {
        /* ignore */
      }
      n.close();
    };
  } catch {
    /* ignore */
  }
}
