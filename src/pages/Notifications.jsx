import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import DeleteButton from "@/components/shared/DeleteButton";
import { useAuth } from "@/lib/AuthContext";
import { timeAgo } from "@/lib/platformConstants";
import { betaBadgeLabel } from "@/lib/plan";
import {
  NOTIFICATION_CATEGORIES,
  categoryCounts,
  deleteNotification,
  ensureNotificationCenter,
  listNotifications,
  markAllRead,
  markRead,
  resolveNotificationCategory,
} from "@/lib/notificationsApi";
import { categoryAccentClass, categoryIcon } from "@/lib/notificationCategories";
import { buildNotificationDigest, rankNotifications } from "@/lib/aiInsights";

const FILTERS = [{ id: "all", label: "All" }, ...NOTIFICATION_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];

export default function Notifications() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "all";
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ all: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [digest, setDigest] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      if (!user?.id) return;
      if (!silent) setLoading(true);
      try {
        await ensureNotificationCenter(user.id);
        const [rows, nextCounts] = await Promise.all([
          listNotifications(user.id, 100, { category, unreadOnly }),
          categoryCounts(user.id),
        ]);
        setNotifications(rankNotifications(rows));
        setCounts(nextCounts);
        setDigest(buildNotificationDigest(rows));
      } catch {
        if (!silent) toast({ variant: "destructive", title: "Couldn't load notifications" });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user?.id, category, unreadOnly]
  );

  useEffect(() => {
    if (authChecked && user?.id) load();
  }, [authChecked, user?.id, load]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const poll = setInterval(() => load(true), 30000);
    return () => clearInterval(poll);
  }, [user?.id, load]);

  const setCategory = (id) => {
    const next = new URLSearchParams(params);
    if (!id || id === "all") next.delete("category");
    else next.set("category", id);
    setParams(next, { replace: true });
  };

  const openNotification = async (notification) => {
    if (!notification.read_at) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
      setCounts((c) => ({
        ...c,
        unread: Math.max(0, (c.unread || 0) - 1),
      }));
      try {
        await markRead(user.id, notification.id);
      } catch {
        toast({ variant: "destructive", title: "Couldn't mark notification read" });
      }
    }
    if (notification.link) navigate(notification.link);
  };

  const readAll = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await markAllRead(user.id, category === "all" ? "all" : category);
      toast({ title: category === "all" ? "All caught up" : "Category marked read" });
      await load(true);
    } catch {
      toast({ variant: "destructive", title: "Couldn't mark notifications read" });
    } finally {
      setSaving(false);
    }
  };

  const activeMeta = useMemo(
    () => NOTIFICATION_CATEGORIES.find((c) => c.id === category) || null,
    [category]
  );

  if (!authChecked || isLoadingAuth) {
    return <PageLoader variant="list" label="Loading notifications" />;
  }

  const hasUnreadInView = notifications.some((n) => !n.read_at);
  const unreadBadge =
    category === "all" ? counts.unread || 0 : counts[`${category}_unread`] || 0;

  return (
    <div className="relative p-4 md:p-8 max-w-3xl mx-auto pb-32">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-titan-cyan/8 blur-[100px]" />
      </div>

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <PageHeader
            title="Notification center"
            subtitle={
              activeMeta
                ? activeMeta.description
                : "Job updates, messages, reviews, account alerts, and system news"
            }
          />
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant={unreadOnly ? "default" : "outline"}
              className={`rounded-xl ${unreadOnly ? "bg-titan-cyan text-black hover:bg-titan-cyan/90" : ""}`}
              onClick={() => setUnreadOnly((v) => !v)}
            >
              Unread only
            </Button>
            <Button
              onClick={readAll}
              disabled={!hasUnreadInView || saving}
              variant="outline"
              className="border-border text-foreground hover:bg-muted rounded-xl"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark {category === "all" ? "all" : "category"} read
                </>
              )}
            </Button>
          </div>
        </div>

        {betaBadgeLabel() && (
          <div className="glass rounded-2xl mb-4 px-4 py-2 border border-titan-cyan/20 text-xs font-semibold text-titan-cyan">
            {betaBadgeLabel()}
          </div>
        )}

        {digest?.title && digest.top?.length > 0 && (
          <div className="glass rounded-2xl border border-titan-cyan/25 bg-titan-cyan/[0.04] px-4 py-3 mb-4" role="status" aria-live="polite">
            <p className="text-xs font-semibold text-titan-cyan">{digest.title}</p>
            <p className="text-sm text-foreground mt-0.5">{digest.body}</p>
          </div>
        )}

        {/* Category filters */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {FILTERS.map((f) => {
            const Icon = categoryIcon(f.id);
            const active = category === f.id;
            const badge =
              f.id === "all" ? counts.unread || 0 : counts[`${f.id}_unread`] || 0;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategory(f.id)}
                className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold border transition-colors ${
                  active
                    ? "bg-titan-cyan text-black border-titan-cyan"
                    : "bg-card border-border text-foreground/80 hover:bg-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {f.label}
                {badge > 0 && (
                  <span
                    className={`min-w-[1.15rem] h-4 px-1 rounded-full text-[10px] flex items-center justify-center ${
                      active ? "bg-black/15 text-black" : "bg-titan-cyan/20 text-titan-cyan"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {unreadBadge > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            {unreadBadge} unread{category !== "all" ? ` in ${activeMeta?.label || "this category"}` : ""}
          </p>
        )}

        {loading ? (
          <PageLoader variant="list" label="Loading notifications" />
        ) : notifications.length ? (
          <div className="glass rounded-2xl border border-border overflow-hidden">
            {notifications.map((notification) => {
              const cat = resolveNotificationCategory(notification);
              const Icon = categoryIcon(cat);
              const meta = NOTIFICATION_CATEGORIES.find((c) => c.id === cat);
              return (
                <div
                  key={notification.id}
                  className={`w-full text-left p-4 sm:p-5 flex gap-3 border-b border-border last:border-0 transition-colors hover:bg-muted/60 ${
                    notification.read_at ? "opacity-70" : "bg-titan-cyan/[0.035]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="flex gap-3 flex-1 min-w-0 text-left"
                  >
                    <div
                      className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${categoryAccentClass(
                        cat,
                        !notification.read_at
                      )}`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-foreground">{notification.title}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(notification.created_at || notification.created_date)}
                        </span>
                      </div>
                      {notification.body && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notification.body}</p>
                      )}
                      <p className="text-[11px] font-medium text-muted-foreground/80 mt-1.5">
                        {meta?.label || "Update"}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground self-center shrink-0" />
                  </button>
                  <DeleteButton
                    label={notification.title || "notification"}
                    onDelete={async () => {
                      await deleteNotification(user.id, notification.id);
                      setNotifications((current) => current.filter((item) => item.id !== notification.id));
                      await load(true);
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass rounded-3xl border border-border">
            <EmptyState
              icon={Bell}
              title={unreadOnly ? "No unread notifications" : "You're all caught up"}
              description={
                category === "all"
                  ? "Job updates, messages, reviews, account alerts, and system news will appear here."
                  : `No ${activeMeta?.label?.toLowerCase() || "items"} right now.`
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
