import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  NOTIFICATION_CATEGORIES,
  ensureNotificationCenter,
  listNotifications,
  markAllRead,
  markRead,
  resolveNotificationCategory,
  unreadCount,
} from "@/lib/notificationsApi";
import { categoryAccentClass, categoryIcon } from "@/lib/notificationCategories";
import { buildNotificationDigest, rankNotifications } from "@/lib/aiInsights";
import { timeAgo } from "@/lib/platformConstants";
import NavBadge from "@/components/shared/NavBadge";

const QUICK_FILTERS = [{ id: "all", label: "All" }, ...NOTIFICATION_CATEGORIES.map((c) => ({ id: c.id, label: c.label.split(" ")[0] }))];

/**
 * Desktop notification center — categorized dropdown inbox.
 */
export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [filter, setFilter] = useState("all");
  const [digest, setDigest] = useState(null);

  const refreshCount = async () => {
    if (!user?.id) {
      setCount(0);
      return;
    }
    try {
      await ensureNotificationCenter(user.id);
      setCount(await unreadCount(user.id));
    } catch {
      setCount(0);
    }
  };

  const loadInbox = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await ensureNotificationCenter(user.id);
      const rows = await listNotifications(user.id, 20, { category: filter });
      const ranked = rankNotifications(rows).slice(0, 12);
      setItems(ranked);
      setCount(await unreadCount(user.id));
      setDigest(buildNotificationDigest(rows));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCount();
    const poll = setInterval(refreshCount, 30000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (open) loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filter]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = async (notification) => {
    if (!notification.read_at && user?.id) {
      setItems((cur) =>
        cur.map((n) =>
          n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setCount((c) => Math.max(0, c - 1));
      try {
        await markRead(user.id, notification.id);
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    if (notification.link) navigate(notification.link);
    else navigate("/notifications");
  };

  const readAll = async () => {
    if (!user?.id || marking) return;
    setMarking(true);
    try {
      await markAllRead(user.id, filter === "all" ? "all" : filter);
      setItems((cur) => cur.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setCount(await unreadCount(user.id));
    } catch {
      /* ignore */
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `${count} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground focus-ring ${
          open ? "bg-muted text-foreground" : ""
        }`}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        <NavBadge count={count} className="absolute -right-0.5 -top-0.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notification center"
            initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Notification center</p>
                <p className="text-xs text-muted-foreground">
                  {digest?.body || (count > 0 ? `${count} unread` : "You're all caught up")}
                </p>
              </div>
              {count > 0 && (
                <button
                  type="button"
                  onClick={readAll}
                  disabled={marking}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 focus-ring disabled:opacity-50"
                >
                  {marking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" />
                  )}
                  Mark read
                </button>
              )}
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
              {QUICK_FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">No notifications yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Jobs, messages, reviews, account, and system updates appear here.
                  </p>
                </div>
              ) : (
                <ul>
                  {items.map((n) => {
                    const cat = resolveNotificationCategory(n);
                    const Icon = categoryIcon(cat);
                    return (
                      <li key={n.id} className="border-b border-border last:border-0">
                        <button
                          type="button"
                          onClick={() => openItem(n)}
                          className={`flex w-full gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-muted/70 focus-ring ${
                            n.read_at ? "opacity-70" : "bg-primary/[0.04]"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${categoryAccentClass(
                              cat,
                              !n.read_at
                            )}`}
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-foreground line-clamp-1">{n.title}</span>
                              <span className="flex-shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                                {timeAgo(n.created_at || n.created_date)}
                              </span>
                            </span>
                            {n.body && (
                              <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                                {n.body}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-border bg-muted/40 px-3 py-2">
              <Link
                to={filter === "all" ? "/notifications" : `/notifications?category=${filter}`}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-2 text-center text-xs font-semibold text-primary hover:bg-primary/10 focus-ring"
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
