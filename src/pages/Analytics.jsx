/**
 * Analytics — activity, engagement, growth, performance, notifications & trends.
 * Prefer /analytics for operational KPIs; /reports for financial deep-dives.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Briefcase,
  LineChart,
  Minus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import PullToRefreshIndicator from "@/components/shared/PullToRefreshIndicator";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useEntityData } from "@/hooks/useEntityData";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useAuth } from "@/lib/AuthContext";
import { buildAnalyticsDashboard } from "@/lib/analyticsDashboard";
import { formatCurrency } from "@/lib/formatCurrency";
import { listNotifications, ensureNotificationCenter } from "@/lib/notificationsApi";
import { unreadMessageCount } from "@/lib/messagesApi";
import { relativeTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

function TrendIcon({ direction }) {
  if (direction === "up") return <ArrowUpRight className="h-3.5 w-3.5 text-success" aria-hidden="true" />;
  if (direction === "down") return <ArrowDownRight className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
}

/** Lightweight sparkline — no chart lib dependency. */
function MiniSparkline({ series = [], colorClass = "text-primary" }) {
  const values = series.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 1);
  const w = 120;
  const h = 36;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-9 w-full", colorClass)} aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

const KPI_ICONS = {
  activity: Activity,
  engagement: Sparkles,
  growth: Users,
  performance: TrendingUp,
};

export default function Analytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: [jobs, invoices, estimates, customers], loading, error, reload } = useEntityData([
    { entity: "Job", method: "list", args: ["-created_date", 200] },
    { entity: "Invoice", method: "list", args: ["-created_date", 200] },
    { entity: "Estimate", method: "list", args: ["-created_date", 100] },
    { entity: "Customer", method: "list", args: ["-created_date", 200] },
  ]);

  const [notifications, setNotifications] = useState([]);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [extraLoading, setExtraLoading] = useState(true);

  const loadExtras = useCallback(async () => {
    if (!user?.id) {
      setExtraLoading(false);
      return;
    }
    setExtraLoading(true);
    try {
      await ensureNotificationCenter(user.id);
      const [rows, unread] = await Promise.all([
        listNotifications(user.id, 40),
        unreadMessageCount(user.id).catch(() => 0),
      ]);
      setNotifications(rows);
      setMessagesUnread(Number(unread) || 0);
    } catch {
      setNotifications([]);
    } finally {
      setExtraLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) {
        setExtraLoading(false);
        return;
      }
      setExtraLoading(true);
      try {
        await ensureNotificationCenter(user.id);
        const [rows, unread] = await Promise.all([
          listNotifications(user.id, 40),
          unreadMessageCount(user.id).catch(() => 0),
        ]);
        if (!alive) return;
        setNotifications(rows);
        setMessagesUnread(Number(unread) || 0);
      } catch {
        if (alive) setNotifications([]);
      } finally {
        if (alive) setExtraLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // loadExtras kept for pull-to-refresh; mount uses alive-guarded effect above
  const refreshAll = useCallback(async () => {
    await Promise.all([reload(), loadExtras()]);
  }, [reload, loadExtras]);

  const { containerRef, pullProgress, isRefreshing, pullDist } = usePullToRefresh(refreshAll);

  const snapshot = useMemo(
    () =>
      buildAnalyticsDashboard({
        jobs,
        invoices,
        estimates,
        customers,
        notifications,
        messagesUnread,
      }),
    [jobs, invoices, estimates, customers, notifications, messagesUnread]
  );

  if (loading && !(jobs?.length > 0)) {
    return <PageLoader variant="list" label="Loading analytics" />;
  }
  if (error) return <ErrorState title="Couldn't load analytics" onRetry={refreshAll} />;

  return (
    <div ref={containerRef} className="page-pad mx-auto max-w-7xl overflow-y-auto">
      <PullToRefreshIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} pullDist={pullDist} />
      {(isRefreshing || extraLoading) && <div className="titan-loading-bar mb-3" aria-hidden="true" />}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Analytics"
          subtitle="Activity, engagement, growth, and performance at a glance"
        />
        <Button variant="outline" className="border-border" onClick={() => navigate("/reports")}>
          <LineChart className="mr-2 h-4 w-4" />
          Full reports
        </Button>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {snapshot.kpis.map((kpi) => {
          const Icon = KPI_ICONS[kpi.id] || Activity;
          return (
            <button
              key={kpi.id}
              type="button"
              onClick={() => navigate(kpi.path)}
              className="titan-surface titan-surface-interactive p-4 text-left focus-ring"
            >
              <div className="mb-2 flex items-center justify-between">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {kpi.trend && <TrendIcon direction={kpi.trend} />}
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                <AnimatedCounter value={kpi.value} />
                {kpi.suffix || ""}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{kpi.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* Activity trends */}
        <section className="titan-surface p-4 md:p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">User activity (7 days)</h2>
            <Briefcase className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <MiniSparkline series={snapshot.activitySeries} />
          <div className="mt-3 flex justify-between gap-1">
            {snapshot.activitySeries.map((d) => (
              <div key={d.date} className="flex-1 text-center">
                <p className="text-sm font-semibold tabular-nums text-foreground">{d.value}</p>
                <p className="text-[10px] text-muted-foreground">{d.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Engagement / performance */}
        <section className="titan-surface p-4 md:p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Engagement score</h2>
          <p className="mb-2 text-3xl font-bold tabular-nums text-foreground">
            <AnimatedCounter value={snapshot.kpis.find((k) => k.id === "engagement")?.value || 0} />
            <span className="text-base font-medium text-muted-foreground">/100</span>
          </p>
          <Progress
            value={snapshot.kpis.find((k) => k.id === "engagement")?.value || 0}
            className="mb-4 h-2.5"
          />
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Trends
          </h3>
          <ul className="space-y-2">
            {snapshot.trends.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{t.label}</span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <TrendIcon direction={t.direction} />
                  {t.change}
                  {t.detail ? <span className="text-muted-foreground">· {t.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Growth / revenue */}
        <section className="titan-surface p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Growth & revenue</h2>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                snapshot.revenue.trend.direction === "up" && "bg-success/15 text-success",
                snapshot.revenue.trend.direction === "down" && "bg-destructive/15 text-destructive",
                snapshot.revenue.trend.direction === "flat" && "bg-muted text-muted-foreground"
              )}
            >
              <TrendIcon direction={snapshot.revenue.trend.direction} />
              {snapshot.revenue.trend.label} MoM
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{snapshot.revenue.monthLabel}</p>
          <p className="mb-3 text-xs text-muted-foreground">Paid revenue this month</p>
          <MiniSparkline series={snapshot.revenueSeries} colorClass="text-success" />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="font-semibold text-foreground">
                {snapshot.revenue.overdueCount} · {formatCurrency(snapshot.revenue.overdueTotal)}
              </p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Pending estimates</p>
              <p className="font-semibold text-foreground">{snapshot.revenue.pendingEstimates}</p>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="titan-surface p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            <Link
              to="/notifications"
              className="text-xs font-medium text-primary hover:underline focus-ring rounded"
            >
              View all
            </Link>
          </div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">
                <AnimatedCounter value={snapshot.notifications.unread} />
              </p>
              <p className="text-xs text-muted-foreground">
                unread of {snapshot.notifications.total} total
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {snapshot.notifications.recent.length === 0 ? (
              <li className="text-sm text-muted-foreground">You&apos;re caught up.</li>
            ) : (
              snapshot.notifications.recent.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => navigate(n.link || "/notifications")}
                    className="flex w-full items-start gap-2 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/60 focus-ring"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{n.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {n.created_at || n.created_date
                          ? relativeTime(n.created_at || n.created_date)
                          : n.type}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/* Recent actions */}
      <section className="titan-surface p-4 md:p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recent actions</h2>
        <ul className="divide-y divide-border">
          {snapshot.recentActions.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">No recent activity yet.</li>
          ) : (
            snapshot.recentActions.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => navigate(a.path)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-ring rounded-md px-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {a.type}
                      {a.meta ? ` · ${a.meta}` : ""}
                      {a.at ? ` · ${relativeTime(a.at)}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
