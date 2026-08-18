import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Receipt,
  Briefcase,
  CreditCard,
  Building2,
  Workflow,
  Brain,
  ContactRound,
} from "lucide-react";

/**
 * TitanOS core navigation.
 *
 * Product rule: the app exposes four product pillars only:
 * 1. Titan Business — run the business.
 * 2. Find Work — find and manage job opportunities.
 * 3. 2nd Self — memory, context, and the invisible interface.
 * 4. Titan Auto — leads and approved automation.
 *
 * Legacy routes stay mounted for compatibility while they are audited/migrated, but
 * they are intentionally excluded from primary navigation so TitanOS can stay focused.
 */
export const APP_NAV_ITEMS = [
  // TITAN BUSINESS
  { icon: LayoutDashboard, label: "Business Home", path: "/", group: "business" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "business" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "business" },
  { icon: Users, label: "Customers", path: "/customers", group: "business" },
  { icon: FileText, label: "Estimates", path: "/estimates", group: "business" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "business" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "business" },

  // FIND WORK
  { icon: Briefcase, label: "Find Work", path: "/hire/matches", group: "find_work" },

  // 2ND SELF / INVISIBLE INTERFACE
  { icon: Brain, label: "2nd Self", path: "/second-me", group: "second_me" },

  // TITAN AUTO + LEADS
  { icon: Workflow, label: "Titan Auto + Leads", path: "/autopilot", group: "growth" },
];

/**
 * Preserved internal/legacy workflows. These routes remain available to existing
 * links and data flows but are deliberately absent from product navigation.
 */
export const INTERNAL_WORKFLOW_ITEMS = [
  { label: "Titan AI", path: "/assistant", group: "second_me", hidden: true },
  { label: "Leads", path: "/leads", group: "growth", hidden: true },
  { label: "Follow-ups", path: "/follow-ups", group: "growth", hidden: true },
  { label: "Job Match Profile", path: "/hire/matches", group: "find_work", hidden: true },
  { label: "Match-ready job", path: "/hire/post-match-ready", group: "business", hidden: true },
  { label: "Profile", path: "/profile", group: "business", hidden: true },
  { label: "Settings", path: "/settings", group: "business", hidden: true },
  { label: "Titan Support", path: "/support", group: "business", hidden: true },
];

export const INTERNAL_WORKFLOW_GROUPS = [
  {
    title: "Compatibility",
    paths: [
      "/assistant",
      "/leads",
      "/follow-ups",
      "/hire/post-match-ready",
      "/hire/candidates",
      "/hire/find-workers",
      "/profile",
      "/settings",
      "/support",
    ],
  },
];

export const NAV_GROUP_META = {
  business: { label: "Titan Business", collapsible: false, defaultOpen: true },
  find_work: { label: "Find Work", collapsible: false, defaultOpen: true },
  second_me: { label: "2nd Self", collapsible: false, defaultOpen: true },
  growth: { label: "Titan Auto", collapsible: false, defaultOpen: true },
};

export const NAV_GROUP_ORDER = ["business", "find_work", "second_me", "growth"];

/** Exactly four mobile roots: one for each Titan product pillar. */
export const MOBILE_TAB_ITEMS = [
  { icon: Building2, label: "Business", path: "/" },
  { icon: Briefcase, label: "Find Work", path: "/hire/matches" },
  { icon: Brain, label: "2nd Self", path: "/second-me" },
  { icon: Workflow, label: "Titan Auto", path: "/autopilot" },
];

export const MOBILE_ROOT_PATHS = MOBILE_TAB_ITEMS.map((item) => item.path);

/** Kept for compatibility with older More-menu imports. The core shell no longer uses it. */
export const MORE_MENU_GROUPS = [];

export const QUICK_CREATE_ACTIONS = [
  { label: "New Job", path: "/jobs?new=1", icon: Briefcase },
  { label: "Create Estimate", path: "/estimates?new=1", icon: FileText },
  { label: "Create Invoice", path: "/invoices?new=1", icon: Receipt },
  { label: "Add Lead", path: "/leads?new=1", icon: ContactRound },
];

export function resolveNavDomain(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  const item =
    APP_NAV_ITEMS.find((n) => n.path === path) ||
    APP_NAV_ITEMS.find((n) => n.path !== "/" && path.startsWith(`${n.path}/`));
  if (item?.group) return item.group;
  if (path.startsWith("/hire")) return "find_work";
  if (path.startsWith("/second-me") || path.startsWith("/assistant")) return "second_me";
  if (path.startsWith("/autopilot") || path.startsWith("/leads") || path.startsWith("/follow-ups")) return "growth";
  return "business";
}

export function navItemsByPaths(paths) {
  return paths.map((path) => APP_NAV_ITEMS.find((item) => item.path === path)).filter(Boolean);
}

export function filterNavItems(items) {
  return items;
}

const LEGACY_TITLES = {
  "/more": "Business Home",
  "/notifications": "Notifications",
  "/driver": "Driver Hub",
  "/routes": "Route Planner",
  "/booking": "Booking",
  "/employees": "Employees",
  "/fleet": "Fleet",
  "/inventory": "Inventory",
  "/business-documents": "Business Documents",
  "/leads": "Leads",
  "/follow-ups": "Follow-ups",
  "/comms": "Communications",
  "/reputation": "Reputation",
  "/finances": "Finances",
  "/reports": "Reports",
  "/tax-center": "Tax Center",
  "/assistant": "2nd Self",
  "/companies": "Business Profile",
  "/profile": "Profile",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/support": "Titan Support",
  "/trust-safety": "Trust & Safety",
  "/subscription": "Subscription",
  "/marketplace": "Marketplace",
  "/hire": "Find Work",
};

export function resolvePageTitle(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";

  if (path.startsWith("/customers/") && path !== "/customers") return "Customer";
  if (path.startsWith("/invoices/") && path !== "/invoices") return "Invoice";
  if (path.startsWith("/hire/matches")) return "Find Work";
  if (path.startsWith("/second-me") || path.startsWith("/assistant")) return "2nd Self";
  if (path.startsWith("/autopilot") || path.startsWith("/leads")) return "Titan Auto + Leads";
  if (path.startsWith("/admin/support")) return "Support Command Center";
  if (path.startsWith("/admin/moderation")) return "Moderation";
  if (path === "/admin") return "Control Center";
  if (path.startsWith("/admin/fees")) return "Fee Management";
  if (path.startsWith("/admin/tax-rules")) return "Tax Rules";
  if (path.startsWith("/driver/trip")) return "Trip detail";
  if (path.startsWith("/driver/") && path !== "/driver") return "Driver profile";
  if (path.startsWith("/book/")) return "Booking";
  if (path.startsWith("/u/")) return "Public profile";
  if (path.startsWith("/sign/")) return "Sign document";

  const exact = APP_NAV_ITEMS.find((item) => item.path === path);
  if (exact) return exact.label;

  const internal = INTERNAL_WORKFLOW_ITEMS.find((item) => item.path === path);
  if (internal) return internal.label;

  return LEGACY_TITLES[path] || "TitanOS";
}

export function resolveNavParent(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path.startsWith("/hire")) return { label: "Find Work", path: "/hire/matches" };
  if (path.startsWith("/assistant") || path.startsWith("/second-me")) return { label: "2nd Self", path: "/second-me" };
  if (path.startsWith("/autopilot") || path.startsWith("/leads") || path.startsWith("/follow-ups")) {
    return { label: "Titan Auto + Leads", path: "/autopilot" };
  }
  if (path.startsWith("/customers")) return { label: "Customers", path: "/customers" };
  if (path.startsWith("/invoices")) return { label: "Invoices", path: "/invoices" };
  if (path.startsWith("/jobs")) return { label: "Jobs", path: "/jobs" };
  if (path.startsWith("/estimates")) return { label: "Estimates", path: "/estimates" };
  if (path.startsWith("/payments")) return { label: "Payments", path: "/payments" };
  return { label: "Business Home", path: "/" };
}
