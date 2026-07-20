import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  DollarSign,
  Clock,
  ChevronRight,
  CheckCircle,
  FileText,
  Zap,
  Calendar,
  CloudSun,
  Sparkles,
  Users,
  CreditCard,
  GripVertical,
  Bot,
  ArrowUpRight,
  Award,
  History,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { DashboardSkeleton } from "@/components/shared/SkeletonLoader";
import ErrorState from "@/components/shared/ErrorState";
import LiveActivityCard from "@/components/dashboard/LiveActivityCard";
import HomeAdClips from "@/components/dashboard/HomeAdClips";
import DriverHubBanner from "@/components/dashboard/DriverHubBanner";
import BusinessTimeline from "@/components/timeline/BusinessTimeline";
import { buildHomeTimelineFeed } from "@/lib/businessTimeline";
import { computeTitanScore } from "@/lib/titanScore";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/date-utils";
import { useDashboardData } from "@/hooks/useDashboardData";
import { fetchOpenMeteo } from "@/lib/weatherApi";
import { QUICK_CREATE_ACTIONS } from "@/lib/nav-items";

const WIDGET_ORDER_KEY = "titanos-cc-widgets";
const DEFAULT_WIDGETS = [
  "kpis",
  "health",
  "schedule",
  "attention",
  "ai",
  "payments",
  "customers",
  "weather",
  "timeline",
  "activity",
  "actions",
];

function loadWidgetOrder() {
  try {
    const raw = localStorage.getItem(WIDGET_ORDER_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_WIDGETS;
    const missing = DEFAULT_WIDGETS.filter((id) => !parsed.includes(id));
    return [...parsed.filter((id) => DEFAULT_WIDGETS.includes(id)), ...missing];
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function WidgetShell({ id, title, icon: Icon, color, children, linkTo, linkLabel, onDragStart, onDragOver, onDrop, dragging }) {
  const navigate = useNavigate();
  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      draggable
      onDragStart={(e) => onDragStart(e, id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, id)}
      className={`titan-card overflow-hidden ${dragging === id ? "opacity-60 ring-2 ring-primary/40" : ""}`}
      style={{ overflowAnchor: "none" }}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing"
            aria-label={`Reorder ${title}`}
            tabIndex={-1}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
        </div>
        {linkTo && (
          <button
            type="button"
            onClick={() => navigate(linkTo)}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            {linkLabel || "See all"} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </motion.section>
  );
}

const RowButton = memo(function RowButton({ icon: Icon, iconClass, label, sub, value, valueClass, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/60 -mx-1 px-1 rounded-xl transition-colors text-left min-h-[52px]"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
      {value != null && <span className={`text-sm font-bold flex-shrink-0 ${valueClass || "text-foreground"}`}>{value}</span>}
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
    </button>
  );
});

const JOB_STATUS = {
  scheduled: "bg-primary/10 text-primary",
  in_progress: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

export default function Dashboard({ isActive = true }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useDashboardData({ enabled: isActive });
  const [widgets, setWidgets] = useState(loadWidgetOrder);
  const [dragging, setDragging] = useState(null);
  const [weather, setWeather] = useState(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  useEffect(() => {
    localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(widgets));
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

  const onDragStart = useCallback((e, id) => {
    setDragging(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || dragging;
    setDragging(null);
    if (!sourceId || sourceId === targetId) return;
    setWidgets((prev) => {
      const next = [...prev];
      const from = next.indexOf(sourceId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, sourceId);
      return next;
    });
  }, [dragging]);

  const shellProps = useMemo(
    () => ({ onDragStart, onDragOver, onDrop, dragging }),
    [onDragStart, onDragOver, onDrop, dragging]
  );

  if (!isActive && !data) return null;
  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <ErrorState
        title="Couldn't load Command Center"
        message="We had trouble fetching your business data. Check your connection and try again."
        onRetry={reload}
      />
    );
  }
  if (!data) return null;

  const health = computeTitanScore({
    invoices: data.invoices || [],
    jobs: data.jobs || [],
    customers: data.customers || [],
    estimates: data.estimates || [],
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

  const widgetMap = {
    kpis: (
      <motion.div
        key="kpis"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 xl:grid-cols-4 gap-3"
        style={{ overflowAnchor: "none" }}
        draggable
        onDragStart={(e) => onDragStart(e, "kpis")}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, "kpis")}
      >
        {[
          {
            label: "Today's Schedule",
            value: data.todayJobs.length,
            sub: `$${data.pipelineToday.toLocaleString()} expected`,
            path: "/jobs",
            icon: Calendar,
          },
          {
            label: "Earned This Week",
            value: `$${data.weekRevenue.toLocaleString()}`,
            sub: revenueChange != null ? `${revenueChange >= 0 ? "+" : ""}${revenueChange}% vs last month` : "Paid invoices",
            path: "/finances",
            icon: DollarSign,
          },
          {
            label: "Pending Invoices",
            value: data.pendingInv.length + data.overdueInv.length,
            sub: `$${data.outstandingTotal.toLocaleString()} outstanding`,
            path: "/invoices",
            icon: FileText,
          },
          {
            label: "Revenue Today",
            value: `$${data.todayRevenue.toLocaleString()}`,
            sub: `${data.inProgressJobs.length} in progress`,
            path: "/reports",
            icon: CreditCard,
          },
        ].map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => navigate(kpi.path)}
            className="titan-card p-4 text-left hover:-translate-y-0.5 transition-transform"
          >
            <div className="flex items-center justify-between mb-3">
              <kpi.icon className="w-4 h-4 text-primary" />
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{kpi.sub}</p>
          </button>
        ))}
      </motion.div>
    ),
    schedule: (
      <WidgetShell key="schedule" id="schedule" title="Today's Schedule" icon={Calendar} color="text-primary" linkTo="/jobs" linkLabel="All jobs" {...shellProps}>
        {data.todayJobs.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">No jobs scheduled today.</p>
            <Button size="sm" onClick={() => navigate("/jobs?new=1")}>Add a job</Button>
          </div>
        ) : (
          data.todayJobs.slice(0, 5).map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => navigate("/jobs")}
              className="w-full flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/60 -mx-1 px-1 rounded-xl text-left"
            >
              <div className="w-1.5 h-10 rounded-full flex-shrink-0 bg-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {job.customer_name}
                  {job.scheduled_time ? ` · ${job.scheduled_time}` : ""}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${JOB_STATUS[job.status] || JOB_STATUS.scheduled}`}>
                {job.status?.replace("_", " ")}
              </span>
            </button>
          ))
        )}
        {data.upcomingJobs.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Coming up</p>
            {data.upcomingJobs.slice(0, 3).map((job) => (
              <p key={job.id} className="text-sm text-foreground py-1.5 truncate">
                <span className="text-muted-foreground">{job.scheduled_date}</span>
                {" · "}
                {job.title}
              </p>
            ))}
          </div>
        )}
      </WidgetShell>
    ),
    attention: (
      <WidgetShell key="attention" id="attention" title="Needs Attention" icon={AlertTriangle} color="text-destructive" linkTo="/invoices" {...shellProps}>
        {data.overdueInv.length === 0 && data.pendingEst.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <CheckCircle className="w-4 h-4 text-success" />
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
                value={`$${(inv.balance_due || inv.total || 0).toLocaleString()}`}
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
                value={`$${(est.total || 0).toLocaleString()}`}
                valueClass="text-warning"
                onClick={() => navigate("/estimates")}
              />
            ))}
          </>
        )}
      </WidgetShell>
    ),
    ai: (
      <WidgetShell key="ai" id="ai" title="AI Suggestions" icon={Sparkles} color="text-primary" linkTo="/assistant" linkLabel="Ask Titan" {...shellProps}>
        <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
          <p className="text-sm text-foreground leading-relaxed">{aiSuggestion}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/assistant")}>
            <Bot className="w-4 h-4" /> Open AI Assistant
          </Button>
        </div>
      </WidgetShell>
    ),
    payments: (
      <WidgetShell key="payments" id="payments" title="Recent Payments" icon={CreditCard} color="text-success" linkTo="/payments" {...shellProps}>
        {data.recentPaid.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No paid invoices yet.</p>
        ) : (
          data.recentPaid.map((inv) => (
            <RowButton
              key={inv.id}
              icon={DollarSign}
              iconClass="bg-success/15 text-success"
              label={inv.customer_name}
              sub={inv.invoice_number || "Invoice"}
              value={`$${(inv.total || 0).toLocaleString()}`}
              valueClass="text-success"
              onClick={() => navigate("/invoices")}
            />
          ))
        )}
      </WidgetShell>
    ),
    customers: (
      <WidgetShell key="customers" id="customers" title="Recent Customers" icon={Users} color="text-primary" linkTo="/customers" {...shellProps}>
        {data.recentCust.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">No customers yet. Add your first to start estimates and invoices.</p>
            <Button size="sm" onClick={() => navigate("/customers?new=1")}>Add Customer</Button>
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
    weather: (
      <WidgetShell key="weather" id="weather" title="Weather" icon={CloudSun} color="text-warning" linkTo="/schedule" linkLabel="Schedule" {...shellProps}>
        {weather ? (
          <div>
            <p className="text-2xl font-bold text-foreground">
              {weather.temp}° <span className="text-base font-medium text-muted-foreground">{weather.label}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">Wind {weather.wind} mph</p>
            {weather.warning && (
              <p className="mt-3 text-sm text-warning bg-warning/10 rounded-xl px-3 py-2">{weather.warning}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading conditions…</p>
        )}
      </WidgetShell>
    ),
    health: (
      <WidgetShell key="health" id="health" title="Business Health" icon={Award} color="text-titan-cyan" linkTo="/titan-score" linkLabel="Full score" {...shellProps}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-titan-cyan/15 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-titan-cyan">{health.score}</span>
            <span className="text-[10px] text-muted-foreground">{health.grade}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">Titan Score</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{health.tips[0]}</p>
            <p className="text-xs text-emerald-400 mt-2">${health.revenue.toLocaleString()} collected · {health.stats.completedJobs} jobs done</p>
          </div>
        </div>
      </WidgetShell>
    ),
    timeline: (
      <WidgetShell key="timeline" id="timeline" title="Business Timeline" icon={History} color="text-primary" linkTo="/customers" linkLabel="Customers" {...shellProps}>
        <BusinessTimeline events={timelineEvents} empty="Complete a job or send an invoice — your timeline starts here." max={8} />
      </WidgetShell>
    ),
    activity: (
      <div key="activity" draggable onDragStart={(e) => onDragStart(e, "activity")} onDragOver={onDragOver} onDrop={(e) => onDrop(e, "activity")}>
        <LiveActivityCard />
      </div>
    ),
    actions: (
      <WidgetShell key="actions" id="actions" title="Do Next" icon={Zap} color="text-primary" {...shellProps}>
        {data.nextActions.map((action, i) => (
          <button
            key={i}
            type="button"
            onClick={() => navigate(action.path)}
            className="w-full flex items-start gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/60 -mx-1 px-1 rounded-xl transition-colors text-left group"
          >
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <action.icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{action.text}</p>
              {action.sub && <p className="text-xs text-muted-foreground">{action.sub}</p>}
            </div>
            <span className="text-xs font-semibold text-primary group-hover:underline flex-shrink-0 mt-0.5">{action.cta}</span>
          </button>
        ))}
      </WidgetShell>
    ),
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto pb-36" style={{ overflowAnchor: "none" }}>
      <DriverHubBanner />

      {/* Command Center hero */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Business Command Center</p>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
          {greeting}, {name}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm md:text-base max-w-2xl">
          Your cockpit for today — schedule, cash, invoices, and AI suggestions in one place.
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1 scrollbar-none">
        {QUICK_CREATE_ACTIONS.map((a) => (
          <Button key={a.path} variant="outline" size="sm" className="flex-shrink-0" onClick={() => navigate(a.path)}>
            <a.icon className="w-4 h-4" />
            {a.label}
          </Button>
        ))}
        <Button size="sm" className="flex-shrink-0" onClick={() => navigate("/assistant")}>
          <Sparkles className="w-4 h-4" /> Ask AI
        </Button>
      </div>

      <HomeAdClips isActive={isActive} />

      <p className="text-xs text-muted-foreground mb-3">Drag widgets to customize your Command Center</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {widgets.map((id) => (
          <div key={id} className={id === "kpis" ? "lg:col-span-2" : undefined} style={{ overflowAnchor: "none" }}>
            {widgetMap[id]}
          </div>
        ))}
      </div>
    </div>
  );
}
