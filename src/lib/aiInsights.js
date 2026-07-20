/**
 * TitanOS AI insights — recommendations, suggested actions,
 * predictive insights, search assist, intelligent notification ranking.
 * Rule + heuristic based; works offline without an API key.
 */
import { APP_NAV_ITEMS, QUICK_CREATE_ACTIONS } from "@/lib/nav-items";
import { resolveNotificationCategory } from "@/lib/notificationsApi";

function hourGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Personalized dashboard brief + recommendations from live dashboard data.
 */
export function buildPersonalizedInsights(data = {}, user = {}) {
  const name = (user.full_name || "").split(" ")[0] || "there";
  const greeting = `${hourGreeting()}, ${name}`;

  const overdue = data.overdueInv?.length || 0;
  const pendingEst = data.pendingEst?.length || 0;
  const todayJobs = data.todayJobs?.length || 0;
  const inProgress = data.inProgressJobs?.length || 0;
  const monthRevenue = data.monthRevenue || 0;
  const prevMonthRevenue = data.prevMonthRevenue || 0;
  const overdueTotal = data.overdueTotal || 0;

  const recommendations = [];
  const suggestedActions = [];
  const predictions = [];

  if (overdue > 0) {
    recommendations.push({
      id: "rec-overdue",
      priority: 100,
      title: "Recover overdue cash",
      body: `${overdue} overdue invoice${overdue === 1 ? "" : "s"} · $${Math.round(overdueTotal).toLocaleString()} outstanding.`,
      path: "/invoices",
      cta: "Open invoices",
    });
    suggestedActions.push({
      id: "act-remind",
      label: "Send payment reminders",
      path: "/invoices",
      reason: "Overdue balances detected",
    });
  }

  if (pendingEst > 0) {
    const top = data.topPendingEst || data.pendingEst?.[0];
    recommendations.push({
      id: "rec-est",
      priority: 90,
      title: "Close open estimates",
      body: top?.customer_name
        ? `Follow up with ${top.customer_name} — estimate still waiting.`
        : `${pendingEst} estimate${pendingEst === 1 ? "" : "s"} awaiting a decision.`,
      path: "/estimates",
      cta: "View estimates",
    });
    suggestedActions.push({
      id: "act-est",
      label: "Chase top estimate",
      path: "/estimates",
      reason: "Pending approvals",
    });
  }

  if (todayJobs > 0) {
    recommendations.push({
      id: "rec-jobs",
      priority: 80,
      title: "Prep today's route",
      body: `${todayJobs} job${todayJobs === 1 ? "" : "s"} on the schedule — confirm materials before you leave.`,
      path: "/jobs",
      cta: "Open jobs",
    });
    suggestedActions.push({
      id: "act-route",
      label: "Open route planner",
      path: "/routes",
      reason: "Jobs scheduled today",
    });
  } else {
    recommendations.push({
      id: "rec-quiet",
      priority: 40,
      title: "Fill a quiet day",
      body: "No jobs today — good time for follow-ups, marketing, or booking page polish.",
      path: "/leads",
      cta: "Check leads",
    });
    suggestedActions.push({
      id: "act-create-job",
      label: "Create a job",
      path: "/jobs?new=1",
      reason: "Empty schedule",
    });
  }

  if (inProgress > 0) {
    recommendations.push({
      id: "rec-progress",
      priority: 70,
      title: "Jobs in progress",
      body: `${inProgress} active job${inProgress === 1 ? "" : "s"} — update status when complete.`,
      path: "/jobs",
      cta: "Update jobs",
    });
  }

  // Predictive insights
  if (prevMonthRevenue > 0) {
    const delta = ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
    predictions.push({
      id: "pred-rev",
      title: "Revenue trend",
      body:
        delta >= 0
          ? `On pace ~${Math.abs(Math.round(delta))}% above last month ($${Math.round(monthRevenue).toLocaleString()} so far).`
          : `Revenue is ~${Math.abs(Math.round(delta))}% behind last month — focus collections and estimate follow-ups.`,
      sentiment: delta >= 0 ? "up" : "down",
      path: "/reports",
    });
  } else if (monthRevenue > 0) {
    predictions.push({
      id: "pred-rev-new",
      title: "Month so far",
      body: `$${Math.round(monthRevenue).toLocaleString()} collected this month.`,
      sentiment: "neutral",
      path: "/finances",
    });
  }

  if (overdue >= 3) {
    predictions.push({
      id: "pred-cash",
      title: "Cash-flow watch",
      body: "Multiple overdue invoices raise short-term cash risk. Prioritize the largest balances first.",
      sentiment: "down",
      path: "/invoices",
    });
  }

  if (todayJobs >= 4) {
    predictions.push({
      id: "pred-capacity",
      title: "Capacity insight",
      body: "Heavy day ahead — stagger travel and confirm crew availability early.",
      sentiment: "neutral",
      path: "/schedule",
    });
  }

  if (predictions.length === 0) {
    predictions.push({
      id: "pred-steady",
      title: "Steady operations",
      body: "No urgent risk signals. Keep logging jobs and reviews to strengthen Titan Score.",
      sentiment: "up",
      path: "/titan-score",
    });
  }

  // Always offer quick creates
  for (const a of QUICK_CREATE_ACTIONS.slice(0, 3)) {
    if (!suggestedActions.some((s) => s.path === a.path)) {
      suggestedActions.push({
        id: `qc-${a.path}`,
        label: a.label,
        path: a.path,
        reason: "Quick create",
      });
    }
  }

  recommendations.sort((a, b) => b.priority - a.priority);
  const primary = recommendations[0];

  return {
    greeting,
    subtitle: "Personalized for how your business looks right now.",
    primaryRecommendation: primary?.body || "Ask Titan AI for a business brief.",
    recommendations: recommendations.slice(0, 5),
    suggestedActions: suggestedActions.slice(0, 6),
    predictions: predictions.slice(0, 4),
  };
}

/**
 * Autocomplete + search assistance extras.
 */
export function getSearchAutocomplete(query = "") {
  const q = String(query || "").trim().toLowerCase();
  const pool = [
    ...APP_NAV_ITEMS.map((i) => ({ label: i.label, path: i.path, type: "page" })),
    ...QUICK_CREATE_ACTIONS.map((a) => ({ label: a.label, path: a.path, type: "action" })),
    { label: "Overdue invoices", path: "/invoices", type: "intent" },
    { label: "Jobs today", path: "/jobs", type: "intent" },
    { label: "Unread messages", path: "/messages", type: "intent" },
    { label: "Trust & Safety", path: "/trust-safety", type: "intent" },
    { label: "Ask Titan AI", path: "/assistant", type: "ai" },
  ];
  if (!q) return pool.slice(0, 6);
  return pool
    .filter((p) => p.label.toLowerCase().includes(q) || q.split(/\s+/).every((w) => p.label.toLowerCase().includes(w)))
    .slice(0, 8);
}

export function getSearchAssistance(query = "") {
  const q = String(query || "").trim().toLowerCase();
  const autocomplete = getSearchAutocomplete(q);
  let tip = "Try a page name, customer action, or “overdue invoices”.";
  if (/invoice|bill|cash|overdue|pay/.test(q)) tip = "Jump to Invoices or Payments to collect cash faster.";
  else if (/job|schedule|route|today/.test(q)) tip = "Open Jobs, Schedule, or Route Planner for today's field work.";
  else if (/message|chat|inbox/.test(q)) tip = "Messages includes search, receipts, and media sharing.";
  else if (/ai|help|recommend|insight/.test(q)) tip = "Titan AI can summarize your business and suggest next steps.";
  else if (/driver|cdl|truck/.test(q)) tip = "Driver Hub finds CDL, van, and OTR drivers near you.";
  else if (q) tip = `Showing matches for “${query.trim()}”. Use ↑↓ then Enter.`;

  return { autocomplete, tip };
}

/**
 * Rank notifications: unread + category urgency + recency.
 */
export function rankNotifications(rows = []) {
  const urgency = {
    account: 50,
    jobs: 45,
    messages: 40,
    reviews: 30,
    system: 20,
  };
  return [...rows]
    .map((n) => {
      const cat = resolveNotificationCategory(n);
      const ageHrs =
        (Date.now() - new Date(n.created_at || n.created_date || 0).getTime()) / 3600000;
      const recency = Math.max(0, 40 - ageHrs);
      const unreadBoost = n.read_at ? 0 : 60;
      const score = (urgency[cat] || 10) + recency + unreadBoost;
      return { ...n, category: cat, _ai_score: score };
    })
    .sort((a, b) => b._ai_score - a._ai_score);
}

/**
 * Intelligent notification digest copy.
 */
export function buildNotificationDigest(rows = []) {
  const ranked = rankNotifications(rows.filter((n) => !n.read_at));
  if (!ranked.length) return { title: "You're caught up", body: "No unread alerts right now.", top: [] };
  const top = ranked.slice(0, 3);
  const jobs = ranked.filter((n) => n.category === "jobs").length;
  const messages = ranked.filter((n) => n.category === "messages").length;
  const parts = [];
  if (jobs) parts.push(`${jobs} job update${jobs === 1 ? "" : "s"}`);
  if (messages) parts.push(`${messages} message${messages === 1 ? "" : "s"}`);
  if (parts.length === 0) parts.push(`${ranked.length} unread`);
  return {
    title: "Priority alerts",
    body: parts.join(" · "),
    top,
  };
}
