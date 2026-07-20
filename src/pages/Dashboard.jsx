import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  MessageSquare,
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  Bell,
  Bookmark,
  Bot,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CloudSun,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  History,
  LayoutGrid,
  RotateCcw,
  Sparkles,
  Star,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { DashboardSkeleton } from "@/components/shared/SkeletonLoader";
import ErrorState from "@/components/shared/ErrorState";
import PageShell from "@/components/shared/PageShell";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import PullToRefreshIndicator from "@/components/shared/PullToRefreshIndicator";
import LiveActivityCard from "@/components/dashboard/LiveActivityCard";
import HomeAdClips from "@/components/dashboard/HomeAdClips";
import BusinessTimeline from "@/components/timeline/BusinessTimeline";
import TitanVerifiedBadge from "@/components/shared/TitanVerifiedBadge";
import TitanScoreBadge from "@/components/shared/TitanScoreBadge";
import { buildHomeTimelineFeed } from "@/lib/businessTimeline";
import {
  computeTitanScore,
  isTitanVerified,
  verificationLevelFromTrust,
} from "@/lib/titanScore";
import { getLocalTrustState } from "@/lib/trustSafetyApi";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/date-utils";
import { useDashboardData } from "@/hooks/useDashboardData";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { fetchOpenMeteo } from "@/lib/weatherApi";
import { formatCurrency } from "@/lib/formatCurrency";
import { QUICK_CREATE_ACTIONS } from "@/lib/nav-items";
import { listNotifications, markRead, resolveNotificationCategory, ensureNotificationCenter } from "@/lib/notificationsApi";
import { categoryAccentClass, categoryIcon } from "@/lib/notificationCategories";
import { buildPersonalizedInsights } from "@/lib/aiInsights";
import { timeAgo } from "@/lib/platformConstants";
import { listConversations, ensureDemoInbox } from "@/lib/messagesApi";
import {
  DEFAULT_WIDGETS,
  WIDGET_META,
  WIDE_WIDGETS,
  addSavedItem,
  loadFavorites,
  loadHiddenWidgets,
  loadSavedItems,
  loadShortcuts,
  loadWidgetOrder,
  moveWidget,
  moveWidgetBy,
  removeSavedItem,
  resetWidgetLayout,
  saveFavorites,
  saveWidgetOrder,
  toggleWidgetVisibility,
} from "@/lib/dashboardPrefs";

const JOB_STATUS = {
  scheduled: "bg-primary/10 text-primary",
  in_progress: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

function WidgetShell({
  id,
  title,
  icon: Icon,
  color,
  children,
  linkTo,
  linkLabel,
  onDragStart,
  onDragOver,
  onDrop,
  dragging,
  customize,
  onMoveUp,
  onMoveDown,
  canUp,
  canDown,
  bare = false,
}) {
  const navigate = useNavigate();
  return (
    <section
      draggable={customize}
      onDragStart={(e) => {
        if (!customize) return;
        onDragStart?.(e, id);
      }}
      onDragOver={(e) => {
        if (!customize) return;
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        if (!customize) return;
        onDrop?.(e, id);
      }}
      className={`overflow-hidden transition-[box-shadow,opacity,transform] duration-base ${
        bare ? "" : "titan-surface"
      } ${
        customize
          ? dragging === id
            ? "opacity-60 ring-2 ring-primary/50 shadow-lift"
            : "ring-1 ring-dashed ring-border hover:ring-primary/40"
          : ""
      }`}
      style={{ overflowAnchor: "none" }}
      aria-grabbed={customize && dragging === id ? true : undefined}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2 md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {customize ? (
            <div className="flex items-center gap-0.5">
              <span
                className="flex h-9 w-9 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing"
                title="Drag to reorder"
                aria-hidden="true"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <button
                type="button"
                disabled={!canUp}
                onClick={() => onMoveUp?.(id)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 focus-ring"
                aria-label={`Move ${title} up`}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!canDown}
                onClick={() => onMoveDown?.(id)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 focus-ring"
                aria-label={`Move ${title} down`}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {linkTo && !customize ? (
          <button
            type="button"
            onClick={() => navigate(linkTo)}
            className="flex min-h-[36px] items-center gap-1 rounded-md px-1 text-xs text-muted-foreground transition-colors hover:text-primary focus-ring"
          >
            {linkLabel || "See all"} <ChevronRight className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      <div className={`px-4 pb-4 md:px-5 md:pb-5 ${customize ? "pointer-events-none select-none" : ""}`}>
        {children}
      </div>
    </section>
  );
}

const RowButton = memo(function RowButton({ icon: Icon, iconClass, label, sub, value, valueClass, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-md border-b border-border px-1 py-3 text-left transition-colors duration-fast last:border-0 hover:bg-muted/60 -mx-1 focus-ring"
    >
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${iconClass}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {value != null && (
        <span className={`flex-shrink-0 text-sm font-bold ${valueClass || "text-foreground"}`}>{value}</span>
      )}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" aria-hidden="true" />
    </button>
  );
});

export default function Dashboard({ isActive = true }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useDashboardData({ enabled: isActive });
  const { containerRef, pullProgress, isRefreshing, pullDist } = usePullToRefresh(
    useCallback(async () => {
      await reload();
    }, [reload])
  );
  const [widgets, setWidgets] = useState(loadWidgetOrder);
  const [hiddenWidgets, setHiddenWidgets] = useState(loadHiddenWidgets);
  const [dragging, setDragging] = useState(null);
  const [customize, setCustomize] = useState(false);
  const [weather, setWeather] = useState(null);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [saved, setSaved] = useState(loadSavedItems);
  const [shortcuts] = useState(loadShortcuts);
  const [notifs, setNotifs] = useState([]);
  const [threads, setThreads] = useState([]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  useEffect(() => {
    saveWidgetOrder(widgets);
  }, [widgets]);

  useEffect(() => {
    if (!isActive) return;
    const load = (lat = 41.88, lon = -87.63) => fetchOpenMeteo(lat, lon).then(setWeather).catch(() => {});
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => load(p.coords.latitude, p.coords.longitude),
        () => load(),
        { timeout: 5000 }
      );
    } else load();
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !user?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        await ensureNotificationCenter(user.id);
        const rows = await listNotifications(user.id, 5);
        if (alive) setNotifs(rows);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [isActive, user?.id]);

  useEffect(() => {
    if (!isActive || !user?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        await ensureDemoInbox(user);
        const rows = await listConversations(user.id);
        if (alive) setThreads((rows || []).slice(0, 5));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [isActive, user?.id]);

  const onDragStart = useCallback((e, id) => {
    setDragging(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e, targetId) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain") || dragging;
      setDragging(null);
      setWidgets((prev) => moveWidget(prev, sourceId, targetId));
    },
    [dragging]
  );

  const onMoveUp = useCallback((id) => {
    setWidgets((prev) => moveWidgetBy(prev, id, -1));
  }, []);

  const onMoveDown = useCallback((id) => {
    setWidgets((prev) => moveWidgetBy(prev, id, 1));
  }, []);

  const shellProps = useMemo(
    () => ({
      onDragStart,
      onDragOver,
      onDrop,
      dragging,
      customize,
      onMoveUp,
      onMoveDown,
    }),
    [onDragStart, onDragOver, onDrop, dragging, customize, onMoveUp, onMoveDown]
  );

  const toggleFav = (item) => {
    const exists = favorites.some((f) => f.path === item.path);
    const next = exists
      ? favorites.filter((f) => f.path !== item.path)
      : [...favorites, item].slice(0, 12);
    setFavorites(next);
    saveFavorites(next);
  };

  const pinJob = (job) => {
    setSaved(
      addSavedItem({
        id: `job-${job.id}`,
        type: "job",
        label: job.title,
        sub: job.customer_name || job.scheduled_date,
        path: "/jobs",
      })
    );
  };

  if (!isActive && !data) return null;
  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <ErrorState
        title="Couldn't load Command Center"
        message="We had trouble fetching your business data. Check your connection and try again — nothing was lost."
        onRetry={reload}
      />
    );
  }
  if (!data) return null;

  const trustState = user?.id ? getLocalTrustState(user.id) : null;
  const verificationLevel = verificationLevelFromTrust(trustState);
  const titanVerified = isTitanVerified({
    verifiedWorker: Boolean(user?.verified_worker),
    trustState,
  });

  const health = computeTitanScore({
    invoices: data.invoices || [],
    jobs: data.jobs || [],
    customers: data.customers || [],
    estimates: data.estimates || [],
    reviews: data.reviews || [],
    verificationLevel,
  });
  const timelineEvents = buildHomeTimelineFeed({
    jobs: data.jobs || [],
    estimates: data.estimates || [],
    invoices: data.invoices || [],
    limit: 8,
  });

  const revenueChange =
    data.prevMonthRevenue > 0
      ? Math.round(((data.monthRevenue - data.prevMonthRevenue) / data.prevMonthRevenue) * 100)
      : null;

  let aiSuggestion =
    "Quiet day — great time to send follow-ups or check in with recent customers.";
  if (data.topPendingEst) {
    aiSuggestion = `Follow up with ${data.topPendingEst.customer_name} — their estimate is still waiting.`;
  } else if (data.overdueInv.length > 0) {
    aiSuggestion = `Send reminders for ${data.overdueInv.length} overdue invoice${data.overdueInv.length !== 1 ? "s" : ""} to recover cash.`;
  } else if (data.todayJobs.length > 0) {
    aiSuggestion = `You have ${data.todayJobs.length} job${data.todayJobs.length !== 1 ? "s" : ""} today — confirm materials and route before you leave.`;
  }

  const insights = buildPersonalizedInsights(
    {
      overdueInv: data.overdueInv,
      pendingEst: data.pendingEst,
      todayJobs: data.todayJobs,
      inProgressJobs: data.inProgressJobs,
      monthRevenue: data.monthRevenue,
      prevMonthRevenue: data.prevMonthRevenue,
      overdueTotal: data.overdueTotal,
      topPendingEst: data.topPendingEst,
    },
    user
  );
  if (insights.primaryRecommendation) aiSuggestion = insights.primaryRecommendation;

  const visibleWidgets = widgets.filter((id) => customize || !hiddenWidgets.includes(id));
  const widgetIndex = (id) => widgets.indexOf(id);

  const withPos = (id, node) =>
    React.cloneElement(node, {
      ...shellProps,
      canUp: widgetIndex(id) > 0,
      canDown: widgetIndex(id) < widgets.length - 1 && widgetIndex(id) >= 0,
    });

  const widgetMap = {
    analytics: withPos(
      "analytics",
      <WidgetShell
        key="analytics"
        id="analytics"
        title="Analytics"
        icon={BarChart3}
        color="text-primary"
        linkTo="/analytics"
        linkLabel="Full analytics"
        {...shellProps}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Today's schedule",
              value: data.todayJobs.length,
              numeric: true,
              sub: `${formatCurrency(data.pipelineToday)} expected`,
              path: "/jobs",
              icon: Calendar,
            },
            {
              label: "Earned this week",
              value: data.weekRevenue,
              currency: true,
              sub:
                revenueChange != null
                  ? `${revenueChange >= 0 ? "+" : ""}${revenueChange}% vs last month`
                  : "Paid invoices",
              path: "/finances",
              icon: DollarSign,
            },
            {
              label: "Pending invoices",
              value: data.pendingInv.length + data.overdueInv.length,
              numeric: true,
              sub: `${formatCurrency(data.outstandingTotal)} outstanding`,
              path: "/invoices",
              icon: FileText,
            },
            {
              label: "Revenue today",
              value: data.todayRevenue,
              currency: true,
              sub: `${data.inProgressJobs.length} in progress`,
              path: "/analytics",
              icon: CreditCard,
            },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={() => navigate(kpi.path)}
              className="min-h-[100px] rounded-lg border border-border bg-muted/30 p-3.5 text-left transition-colors hover:bg-muted/60 focus-ring"
            >
              <div className="mb-2 flex items-center justify-between">
                <kpi.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="mb-1 text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {kpi.currency ? (
                  <AnimatedCounter value={kpi.value} format={(n) => formatCurrency(n)} />
                ) : kpi.numeric ? (
                  <AnimatedCounter value={kpi.value} />
                ) : (
                  kpi.value
                )}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{kpi.sub}</p>
            </button>
          ))}
        </div>
      </WidgetShell>
    ),
    quickActions: withPos(
      "quickActions",
      <WidgetShell
        key="quickActions"
        id="quickActions"
        title="Quick actions"
        icon={Zap}
        color="text-primary"
        {...shellProps}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_CREATE_ACTIONS.map((a) => (
            <button
              key={a.path}
              type="button"
              onClick={() => navigate(a.path)}
              className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-3 text-center transition-colors duration-fast hover:bg-muted focus-ring"
            >
              <a.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                {a.label.replace("Create ", "").replace("New ", "")}
              </span>
            </button>
          ))}
        </div>
        {data.nextActions?.length > 0 && (
          <div className="mt-3 border-t border-border pt-2">
            {data.nextActions.slice(0, 3).map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => navigate(action.path)}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-muted/60 focus-ring"
              >
                <action.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{action.text}</span>
                <span className="text-xs font-semibold text-primary">{action.cta}</span>
              </button>
            ))}
          </div>
        )}
      </WidgetShell>
    ),
    upcoming: withPos(
      "upcoming",
      <WidgetShell
        key="upcoming"
        id="upcoming"
        title="Upcoming tasks"
        icon={Calendar}
        color="text-primary"
        linkTo="/jobs"
        linkLabel="All jobs"
        {...shellProps}
      >
        {data.todayJobs.length === 0 && data.upcomingJobs.length === 0 ? (
          <div className="py-4 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Nothing scheduled. Add a job to fill the day.</p>
            <Button size="sm" onClick={() => navigate("/jobs?new=1")}>
              Add a job
            </Button>
          </div>
        ) : (
          <>
            {data.todayJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center gap-2 border-b border-border last:border-0">
                <button
                  type="button"
                  onClick={() => navigate("/jobs")}
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-3 text-left hover:bg-muted/60 focus-ring"
                >
                  <div className="h-10 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {job.customer_name}
                      {job.scheduled_time ? ` · ${job.scheduled_time}` : " · Today"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${JOB_STATUS[job.status] || JOB_STATUS.scheduled}`}>
                    {job.status?.replace("_", " ")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => pinJob(job)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary focus-ring"
                  aria-label="Save job"
                >
                  <Bookmark className="h-4 w-4" />
                </button>
              </div>
            ))}
            {data.upcomingJobs.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coming up</p>
                {data.upcomingJobs.slice(0, 3).map((job) => (
                  <p key={job.id} className="truncate py-1.5 text-sm text-foreground">
                    <span className="text-muted-foreground">{job.scheduled_date}</span>
                    {" · "}
                    {job.title}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </WidgetShell>
    ),
    messages: withPos(
      "messages",
      <WidgetShell
        key="messages"
        id="messages"
        title="Messages"
        icon={MessageSquare}
        color="text-primary"
        linkTo="/messages"
        linkLabel="Inbox"
        {...shellProps}
      >
        {threads.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No conversations yet.</p>
        ) : (
          threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/messages?thread=${encodeURIComponent(t.id)}`)}
              className={`flex min-h-[52px] w-full gap-3 rounded-md border-b border-border px-1 py-3 text-left last:border-0 hover:bg-muted/60 focus-ring ${
                t.unread ? "" : "opacity-80"
              }`}
            >
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {(t.peer_name || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{t.peer_name}</span>
                  {t.unread > 0 ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {t.unread}
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t.last_preview || "Conversation"}
                </span>
              </span>
            </button>
          ))
        )}
      </WidgetShell>
    ),
    notifications: withPos(
      "notifications",
      <WidgetShell
        key="notifications"
        id="notifications"
        title="Notifications"
        icon={Bell}
        color="text-primary"
        linkTo="/notifications"
        linkLabel="Inbox"
        {...shellProps}
      >
        {notifs.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          notifs.map((n) => {
            const cat = resolveNotificationCategory(n);
            const Icon = categoryIcon(cat);
            return (
            <button
              key={n.id}
              type="button"
              onClick={async () => {
                if (!n.read_at && user?.id) {
                  setNotifs((cur) =>
                    cur.map((row) =>
                      row.id === n.id ? { ...row, read_at: new Date().toISOString() } : row
                    )
                  );
                  try {
                    await markRead(user.id, n.id);
                  } catch {
                    /* ignore */
                  }
                }
                navigate(n.link || "/notifications");
              }}
              className={`flex min-h-[52px] w-full gap-3 rounded-md border-b border-border px-1 py-3 text-left last:border-0 hover:bg-muted/60 focus-ring ${
                n.read_at ? "opacity-70" : ""
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
                <span className="block truncate text-sm font-medium text-foreground">{n.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {timeAgo(n.created_at || n.created_date)}
                </span>
              </span>
            </button>
            );
          })
        )}
      </WidgetShell>
    ),
    recommendations: withPos(
      "recommendations",
      <WidgetShell
        key="recommendations"
        id="recommendations"
        title="Recommendations"
        icon={Sparkles}
        color="text-primary"
        linkTo="/assistant"
        linkLabel="Ask Titan"
        {...shellProps}
      >
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
            <p className="mb-1 text-xs font-semibold text-primary">{insights.greeting}</p>
            <p className="text-sm leading-relaxed text-foreground">{aiSuggestion}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate("/assistant")}>
                <Bot className="h-4 w-4" /> Open AI
              </Button>
              {insights.suggestedActions.slice(0, 2).map((a) => (
                <Button key={a.id} size="sm" variant="outline" onClick={() => navigate(a.path)}>
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
          {insights.predictions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Predictive insights</p>
              <ul className="space-y-2">
                {insights.predictions.slice(0, 2).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => navigate(p.path)}
                      className="w-full rounded-md border border-border px-3 py-2 text-left hover:bg-muted/60 focus-ring"
                    >
                      <span className="block text-sm font-medium text-foreground">{p.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{p.body}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </WidgetShell>
    ),
    activity: withPos(
      "activity",
      <WidgetShell
        key="activity"
        id="activity"
        title="Live activity"
        icon={Activity}
        color="text-primary"
        linkTo="/community"
        linkLabel="Community"
        {...shellProps}
      >
        <LiveActivityCard embedded />
      </WidgetShell>
    ),
    favorites: withPos(
      "favorites",
      <WidgetShell key="favorites" id="favorites" title="Favorites" icon={Star} color="text-warning" {...shellProps}>
        <div className="grid grid-cols-2 gap-2">
          {favorites.map((f) => (
            <div key={f.path} className="group relative">
              <button
                type="button"
                onClick={() => navigate(f.path)}
                className="flex min-h-[56px] w-full items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted focus-ring"
              >
                <Star className="h-4 w-4 flex-shrink-0 fill-warning text-warning" aria-hidden="true" />
                <span className="truncate text-sm font-semibold text-foreground">{f.label}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleFav(f)}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-100 hover:bg-card hover:text-destructive focus-ring focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                aria-label={`Remove ${f.label} from favorites`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: "sched", label: "Schedule", path: "/schedule" },
            { id: "est", label: "Estimates", path: "/estimates" },
            { id: "fin", label: "Finances", path: "/finances" },
            { id: "hire", label: "Hire", path: "/hire" },
            { id: "msg", label: "Messages", path: "/messages" },
          ]
            .filter((x) => !favorites.some((f) => f.path === x.path))
            .map((x) => (
              <button
                key={x.path}
                type="button"
                onClick={() => toggleFav(x)}
                className="rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary focus-ring"
              >
                + {x.label}
              </button>
            ))}
        </div>
      </WidgetShell>
    ),
    shortcuts: withPos(
      "shortcuts",
      <WidgetShell key="shortcuts" id="shortcuts" title="Shortcuts" icon={LayoutGrid} color="text-primary" {...shellProps}>
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((s) => (
            <Button key={s.id} variant="outline" size="sm" className="min-h-[44px]" onClick={() => navigate(s.path)}>
              {s.label}
            </Button>
          ))}
        </div>
      </WidgetShell>
    ),
    saved: withPos(
      "saved",
      <WidgetShell key="saved" id="saved" title="Saved items" icon={Bookmark} color="text-primary" {...shellProps}>
        {saved.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Pin jobs from Upcoming with the bookmark icon — they show up here.
          </p>
        ) : (
          saved.map((item) => (
            <div key={item.id} className="flex items-center gap-2 border-b border-border last:border-0">
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 px-1 py-2 text-left hover:bg-muted/60 focus-ring rounded-md"
              >
                <Bookmark className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                  {item.sub && <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSaved(removeSavedItem(item.id))}
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-ring"
                aria-label="Remove saved item"
              >
                ×
              </button>
            </div>
          ))
        )}
      </WidgetShell>
    ),
    attention: withPos(
      "attention",
      <WidgetShell
        key="attention"
        id="attention"
        title="Needs attention"
        icon={AlertTriangle}
        color="text-destructive"
        linkTo="/invoices"
        {...shellProps}
      >
        {data.overdueInv.length === 0 && data.pendingEst.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <p className="text-sm text-success">You're all caught up.</p>
          </div>
        ) : (
          <>
            {data.overdueInv.slice(0, 3).map((inv) => (
              <RowButton
                key={inv.id}
                icon={AlertTriangle}
                iconClass="bg-destructive/10 text-destructive"
                label={`Overdue — ${inv.customer_name}`}
                sub={`Due ${inv.due_date ? relativeTime(inv.due_date) : "unknown"}`}
                value={formatCurrency(inv.balance_due || inv.total || 0)}
                valueClass="text-destructive"
                onClick={() => navigate("/invoices")}
              />
            ))}
            {data.pendingEst.slice(0, 2).map((est) => (
              <RowButton
                key={est.id}
                icon={FileText}
                iconClass="bg-warning/15 text-warning"
                label={`Estimate — ${est.customer_name}`}
                sub={est.valid_until ? `Expires ${relativeTime(est.valid_until)}` : "Awaiting reply"}
                value={formatCurrency(est.total || 0)}
                valueClass="text-warning"
                onClick={() => navigate("/estimates")}
              />
            ))}
          </>
        )}
      </WidgetShell>
    ),
    payments: withPos(
      "payments",
      <WidgetShell
        key="payments"
        id="payments"
        title="Recent payments"
        icon={CreditCard}
        color="text-success"
        linkTo="/payments"
        {...shellProps}
      >
        {data.recentPaid.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No paid invoices yet.</p>
        ) : (
          data.recentPaid.map((inv) => (
            <RowButton
              key={inv.id}
              icon={DollarSign}
              iconClass="bg-success/15 text-success"
              label={inv.customer_name}
              sub={inv.invoice_number || "Invoice"}
              value={formatCurrency(inv.total || 0)}
              valueClass="text-success"
              onClick={() => navigate("/invoices")}
            />
          ))
        )}
      </WidgetShell>
    ),
    customers: withPos(
      "customers",
      <WidgetShell
        key="customers"
        id="customers"
        title="Recent customers"
        icon={Users}
        color="text-primary"
        linkTo="/customers"
        {...shellProps}
      >
        {data.recentCust.length === 0 ? (
          <div className="py-4 text-center">
            <p className="mb-3 text-sm text-muted-foreground">No customers yet.</p>
            <Button size="sm" onClick={() => navigate("/customers?new=1")}>
              Add Customer
            </Button>
          </div>
        ) : (
          data.recentCust.map((c) => (
            <RowButton
              key={c.id}
              icon={Users}
              iconClass="bg-primary/10 text-primary"
              label={c.name || c.company_name || "Customer"}
              sub={c.email || c.phone || "No contact"}
              onClick={() => navigate(`/customers/${c.id}`, { state: { customer: c } })}
            />
          ))
        )}
      </WidgetShell>
    ),
    weather: withPos(
      "weather",
      <WidgetShell
        key="weather"
        id="weather"
        title="Weather"
        icon={CloudSun}
        color="text-warning"
        linkTo="/schedule"
        linkLabel="Schedule"
        {...shellProps}
      >
        {weather ? (
          <div>
            <p className="text-2xl font-bold text-foreground">
              {weather.temp}° <span className="text-base font-medium text-muted-foreground">{weather.label}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Wind {weather.wind} mph</p>
            {weather.warning && (
              <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">{weather.warning}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading conditions…</p>
        )}
      </WidgetShell>
    ),
    health: withPos(
      "health",
      <WidgetShell
        key="health"
        id="health"
        title="Titan Score"
        icon={Award}
        color="text-primary"
        linkTo="/titan-score"
        linkLabel="Full score"
        {...shellProps}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-lg bg-primary/10">
            <span className="text-2xl font-bold text-primary">{health.score}</span>
            <span className="text-[10px] text-muted-foreground">{health.grade}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Trust score</p>
              {titanVerified ? <TitanVerifiedBadge size="sm" showLabel /> : null}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{health.tips[0]}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(health.factors || {})
                .slice(0, 3)
                .map(([k, v]) => (
                  <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                    {k} {v}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </WidgetShell>
    ),
    timeline: withPos(
      "timeline",
      <WidgetShell
        key="timeline"
        id="timeline"
        title="Recent activity"
        icon={History}
        color="text-primary"
        linkTo="/customers"
        linkLabel="Customers"
        {...shellProps}
      >
        <BusinessTimeline
          events={timelineEvents}
          empty="Complete a job or send an invoice — your timeline starts here."
          max={8}
        />
      </WidgetShell>
    ),
  };

  const unreadNotifs = notifs.filter((n) => !n.read_at).length;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const handleResetLayout = () => {
    const { order, hidden } = resetWidgetLayout();
    setWidgets(order);
    setHiddenWidgets(hidden);
  };

  return (
    <PageShell
      maxWidth="xl"
      dense
      className="overflow-y-auto pb-36"
      style={{ overflowAnchor: "none" }}
      ref={containerRef}
    >
      <PullToRefreshIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} pullDist={pullDist} />

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-caption font-bold uppercase tracking-widest text-primary">
            Command Center · {todayLabel}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {greeting}, {name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Your personalized cockpit — analytics, alerts, favorites, and next steps in one place.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TitanScoreBadge score={health.score} grade={health.grade} size="md" />
            {titanVerified ? <TitanVerifiedBadge size="sm" /> : null}
            <button
              type="button"
              onClick={() => navigate("/jobs")}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted focus-ring"
            >
              {data.todayJobs.length} job{data.todayJobs.length !== 1 ? "s" : ""} today
            </button>
            {unreadNotifs > 0 ? (
              <button
                type="button"
                onClick={() => navigate("/notifications")}
                className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary focus-ring"
              >
                {unreadNotifs} unread
              </button>
            ) : null}
            {data.overdueInv.length > 0 ? (
              <button
                type="button"
                onClick={() => navigate("/invoices")}
                className="rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive focus-ring"
              >
                {data.overdueInv.length} overdue
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {customize ? (
            <Button variant="outline" size="sm" className="min-h-[44px]" onClick={handleResetLayout}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset layout
            </Button>
          ) : null}
          <Button
            variant={customize ? "default" : "outline"}
            size="sm"
            className="min-h-[44px]"
            onClick={() => setCustomize((v) => !v)}
            aria-pressed={customize}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            {customize ? "Done" : "Customize"}
          </Button>
        </div>
      </header>

      {customize && (
        <div className="mb-4 space-y-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-4 text-sm text-foreground">
          <div>
            <p className="font-semibold text-foreground">Arrange your Command Center</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag widgets by the grip handle, or use ↑↓. Toggle visibility below. Changes save automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_WIDGETS.map((id) => {
              const on = !hiddenWidgets.includes(id);
              const label = WIDGET_META[id]?.label || id;
              const desc = WIDGET_META[id]?.description;
              return (
                <button
                  key={id}
                  type="button"
                  title={desc}
                  onClick={() => setHiddenWidgets((h) => toggleWidgetVisibility(h, id))}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md border px-3 text-xs font-semibold focus-ring ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground"
                  }`}
                  aria-pressed={on}
                >
                  {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <HomeAdClips isActive={isActive} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visibleWidgets.map((id) => (
          <div
            key={id}
            className={`${WIDE_WIDGETS.has(id) ? "lg:col-span-2" : ""} ${
              customize && hiddenWidgets.includes(id) ? "opacity-45" : ""
            }`}
            style={{ overflowAnchor: "none" }}
          >
            {widgetMap[id]}
          </div>
        ))}
      </div>
    </PageShell>
  );
}
