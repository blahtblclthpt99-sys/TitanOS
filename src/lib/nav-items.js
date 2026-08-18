import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Receipt,
  Truck,
  DollarSign,
  Bot,
  Briefcase,
  BarChart3,
  LineChart,
  Settings,
  ClipboardList,
  Shield,
  Bell,
  ShieldAlert,
  CalendarCheck,
  FileSignature,
  CreditCard,
  Route,
  Building2,
  Package,
  UserCog,
  MessageSquare,
  Star,
  ContactRound,
  User,
  Percent,
  Landmark,
  Radio,
  Workflow,
  Car,
  BadgeCheck,
  LifeBuoy,
  Brain,
  FolderOpen,
} from "lucide-react";

/**
 * TitanOS practical navigation.
 * Keep core destinations visible; merged/postponed tools remain available through
 * their canonical parent feature or compatibility routes rather than cluttering chrome.
 */
export const APP_NAV_ITEMS = [
  // TODAY
  { icon: LayoutDashboard, label: "Home", path: "/", group: "today" },
  { icon: Bell, label: "Notifications", path: "/notifications", group: "today" },

  // WORK
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "work" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "work" },
  { icon: Car, label: "Driver Hub", path: "/driver", group: "work" },
  { icon: Route, label: "Route Planner", path: "/routes", group: "work" },
  { icon: CalendarCheck, label: "Booking", path: "/booking", group: "work" },
  { icon: UserCog, label: "Employees", path: "/employees", group: "work" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "work" },
  { icon: Package, label: "Inventory", path: "/inventory", group: "work" },
  { icon: FolderOpen, label: "Business Documents", path: "/business-documents", group: "work" },

  // CUSTOMERS
  { icon: Users, label: "Customers", path: "/customers", group: "customers" },
  { icon: ContactRound, label: "Leads", path: "/leads", group: "customers" },
  { icon: MessageSquare, label: "Follow-ups", path: "/follow-ups", group: "customers" },
  { icon: Radio, label: "Communications", path: "/comms", group: "customers" },
  { icon: Star, label: "Reputation", path: "/reputation", group: "customers" },

  // MONEY
  { icon: FileText, label: "Estimates", path: "/estimates", group: "money" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "money" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "money" },
  { icon: DollarSign, label: "Finances", path: "/finances", group: "money" },
  { icon: BarChart3, label: "Reports", path: "/reports", group: "money" },
  { icon: ClipboardList, label: "Tax Center", path: "/tax-center", group: "money" },

  // SECOND ME
  { icon: Brain, label: "Second Me", path: "/second-me", group: "second_me" },
  { icon: Bot, label: "TitanAI", path: "/assistant", group: "second_me" },
  { icon: Workflow, label: "Autopilot", path: "/autopilot", group: "second_me" },

  // BUSINESS
  { icon: Building2, label: "My Business", path: "/companies", group: "business" },
  { icon: User, label: "Profile", path: "/profile", group: "business" },
  { icon: LineChart, label: "Analytics", path: "/analytics", group: "business" },
  { icon: Settings, label: "Settings", path: "/settings", group: "business" },

  // SUPPORT & SAFETY
  { icon: LifeBuoy, label: "Titan Support", path: "/support", group: "support" },
  { icon: Shield, label: "Trust & Safety", path: "/trust-safety", group: "support" },

  // ADMIN — actual server/route authorization is still mandatory.
  { icon: Shield, label: "Control Center", path: "/admin", group: "administration", adminOnly: true },
  { icon: LifeBuoy, label: "Support Command Center", path: "/admin/support", group: "administration", adminOnly: true },
  { icon: ShieldAlert, label: "Moderation", path: "/admin/moderation", group: "administration", adminOnly: true },
  { icon: Percent, label: "Fee Management", path: "/admin/fees", group: "administration", adminOnly: true },
  { icon: Landmark, label: "Tax Rules", path: "/admin/tax-rules", group: "administration", adminOnly: true },
];

export const NAV_GROUP_META = {
  today: { label: "Today", collapsible: false, defaultOpen: true },
  work: { label: "Work", collapsible: true, defaultOpen: true },
  customers: { label: "Customers", collapsible: true, defaultOpen: true },
  money: { label: "Money", collapsible: true, defaultOpen: true },
  second_me: { label: "Second Me", collapsible: true, defaultOpen: true },
  business: { label: "Business", collapsible: true, defaultOpen: false },
  support: { label: "Support & Safety", collapsible: true, defaultOpen: false },
  administration: { label: "Admin", collapsible: true, defaultOpen: false },
};

export const NAV_GROUP_ORDER = [
  "today",
  "work",
  "customers",
  "money",
  "second_me",
  "business",
  "support",
  "administration",
];

/** Keep mobile focused on the four highest-frequency roots; More exposes the rest. */
export const MOBILE_TAB_ITEMS = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: Car, label: "Driver", path: "/driver" },
  { icon: Radio, label: "Comms", path: "/comms" },
];

export const MOBILE_ROOT_PATHS = ["/", "/jobs", "/driver", "/comms", "/more"];

export const MORE_MENU_GROUPS = [
  {
    title: "Today",
    description: "What is happening and what needs your attention",
    paths: ["/", "/notifications"],
  },
  {
    title: "Work",
    description: "Plan, dispatch, complete, and document work",
    paths: ["/jobs", "/schedule", "/driver", "/routes", "/booking", "/employees", "/fleet", "/inventory", "/business-documents"],
  },
  {
    title: "Customers",
    description: "Manage customers, leads, communication, and reputation",
    paths: ["/customers", "/leads", "/follow-ups", "/comms", "/reputation"],
  },
  {
    title: "Money",
    description: "Estimate, invoice, collect, track, and report",
    paths: ["/estimates", "/invoices", "/payments", "/finances", "/reports", "/tax-center"],
  },
  {
    title: "Second Me",
    description: "Memory, intelligence, and approved automation",
    paths: ["/second-me", "/assistant", "/autopilot"],
  },
  {
    title: "Business",
    description: "Your business, profile, analytics, and settings",
    paths: ["/companies", "/profile", "/analytics", "/settings"],
  },
  {
    title: "Support & Safety",
    description: "Get help and manage safety",
    paths: ["/support", "/trust-safety"],
  },
  {
    title: "Admin",
    description: "Authorized staff controls",
    paths: ["/admin", "/admin/support", "/admin/moderation", "/admin/fees", "/admin/tax-rules"],
  },
];

export const QUICK_CREATE_ACTIONS = [
  { label: "New Job", path: "/jobs?new=1", icon: Briefcase },
  { label: "Create Estimate", path: "/estimates?new=1", icon: FileText },
  { label: "Invoice", path: "/invoices?new=1", icon: Receipt },
  { label: "Customer", path: "/customers?new=1", icon: Users },
];

export function resolveNavDomain(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  const item =
    APP_NAV_ITEMS.find((n) => n.path === path) ||
    APP_NAV_ITEMS.find((n) => n.path !== "/" && path.startsWith(`${n.path}/`));
  return item?.group || "today";
}

export function navItemsByPaths(paths) {
  return paths.map((path) => APP_NAV_ITEMS.find((item) => item.path === path)).filter(Boolean);
}

export function filterNavItems(items, { isAdmin = false } = {}) {
  return items.filter((item) => !item.adminOnly || isAdmin);
}

export function resolvePageTitle(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";

  if (path === "/") return "Home";
  if (path === "/more") return "More";
  if (path.startsWith("/driver/trip")) return "Trip detail";
  if (path.startsWith("/driver/") && path !== "/driver") return "Driver profile";
  if (path.startsWith("/customers/") && path !== "/customers") return "Customer";
  if (path.startsWith("/invoices/") && path !== "/invoices") return "Invoice";
  if (path.startsWith("/features/")) return "Feature";
  if (path.startsWith("/admin/support")) return "Support Command Center";
  if (path.startsWith("/admin/moderation")) return "Moderation";
  if (path === "/admin") return "Control Center";
  if (path.startsWith("/admin/fees")) return "Fee Management";
  if (path.startsWith("/admin/tax-rules")) return "Tax Rules";
  if (path.startsWith("/book/")) return "Booking";
  if (path.startsWith("/u/")) return "Public profile";
  if (path.startsWith("/sign/")) return "Sign document";

  const exact = APP_NAV_ITEMS.find((item) => item.path === path);
  if (exact) return exact.label;

  const tab = MOBILE_TAB_ITEMS.find((item) => item.path === path);
  if (tab) return tab.label === "Driver" ? "Driver Hub" : tab.label;

  const prefix = APP_NAV_ITEMS.find((item) => item.path !== "/" && path.startsWith(`${item.path}/`));
  if (prefix) return prefix.label;

  return "TitanOS";
}

export function resolveNavParent(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path.startsWith("/driver")) return { label: "Driver Hub", path: "/driver" };
  if (path.startsWith("/customers")) return { label: "Customers", path: "/customers" };
  if (path.startsWith("/invoices")) return { label: "Invoices", path: "/invoices" };
  if (path.startsWith("/jobs")) return { label: "Jobs", path: "/jobs" };
  if (path.startsWith("/estimates")) return { label: "Estimates", path: "/estimates" };
  if (path.startsWith("/comms")) return { label: "Communications", path: "/comms" };
  if (path.startsWith("/assistant")) return { label: "TitanAI", path: "/assistant" };
  if (path.startsWith("/business-documents") || path.startsWith("/credentials") || path.startsWith("/contracts") || path.startsWith("/insurance")) {
    return { label: "Business Documents", path: "/business-documents" };
  }
  if (path.startsWith("/support")) return { label: "Titan Support", path: "/support" };
  if (path.startsWith("/admin")) return { label: "More", path: "/more" };
  return { label: "More", path: "/more" };
}
