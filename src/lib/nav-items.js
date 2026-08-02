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
  Store,
  ClipboardList,
  Shield,
  UserPlus,
  UsersRound,
  Calculator,
  Bell,
  ShieldAlert,
  CalendarCheck,
  FileSignature,
  CreditCard,
  Route,
  ScanLine,
  Building2,
  Package,
  UserCog,
  MessageSquare,
  Star,
  BadgeCheck,
  ContactRound,
  Sparkles,
  User,
  Award,
  Megaphone,
  Tag,
  Siren,
  ShieldCheck,
  PhoneCall,
  Car,
  Palette,
  Percent,
  Landmark,
  Radio,
} from "lucide-react";

/**
 * OS information architecture — domains, not a flat page list.
 * Groups: live | history | analytics | reports | communication | ai | configuration | administration | labs
 * Admin-only items filtered in Sidebar / MoreMenu.
 */
export const APP_NAV_ITEMS = [
  // —— Live — what is happening now
  { icon: Car, label: "Driver Hub", path: "/driver", group: "live" },
  { icon: LayoutDashboard, label: "Command Center", path: "/", group: "live" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "live" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "live" },
  { icon: Store, label: "Marketplace", path: "/marketplace", group: "live" },
  { icon: UserPlus, label: "Hire Workers", path: "/hire", group: "live" },
  { icon: CalendarCheck, label: "Booking", path: "/booking", group: "live" },

  // —— History — records
  { icon: Users, label: "Customers", path: "/customers", group: "history" },
  { icon: FileText, label: "Estimates", path: "/estimates", group: "history" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "history" },
  { icon: ContactRound, label: "Leads", path: "/leads", group: "history" },
  { icon: FileSignature, label: "Contracts", path: "/contracts", group: "history" },
  { icon: Shield, label: "Insurance", path: "/insurance", group: "history" },

  // —— Analytics — understand performance
  { icon: LineChart, label: "Analytics", path: "/analytics", group: "analytics" },
  { icon: Star, label: "Reputation", path: "/reputation", group: "analytics" },
  { icon: Award, label: "Titan Score", path: "/titan-score", group: "analytics" },

  // —— Reports — money summaries & exports
  { icon: BarChart3, label: "Reports", path: "/reports", group: "reports" },
  { icon: DollarSign, label: "Finances", path: "/finances", group: "reports" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "reports" },
  { icon: ClipboardList, label: "1099 Tax Center", path: "/tax-center", group: "reports" },
  { icon: ScanLine, label: "Receipt Scanner", path: "/receipts", group: "reports" },

  // —— Communication
  { icon: Radio, label: "TitanCom", path: "/comms", group: "communication" },
  { icon: MessageSquare, label: "Messages", path: "/messages", group: "communication" },
  { icon: UsersRound, label: "Community", path: "/community", group: "communication" },
  { icon: Bell, label: "Notifications", path: "/notifications", group: "communication" },
  { icon: MessageSquare, label: "Follow-ups", path: "/follow-ups", group: "communication" },

  // —— AI
  { icon: Bot, label: "Titan AI", path: "/assistant", group: "ai" },
  { icon: Megaphone, label: "AI Marketing", path: "/marketing", group: "ai" },
  { icon: Sparkles, label: "Growth Coach", path: "/growth-coach", group: "ai" },

  // —— Configuration — setup self / business / assets
  { icon: Settings, label: "Settings", path: "/settings", group: "configuration" },
  { icon: User, label: "Professional Profile", path: "/profile", group: "configuration" },
  { icon: Building2, label: "Companies", path: "/companies", group: "configuration" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "configuration" },
  { icon: UserCog, label: "Employees", path: "/employees", group: "configuration" },
  { icon: Package, label: "Inventory", path: "/inventory", group: "configuration" },
  { icon: BadgeCheck, label: "Credentials", path: "/credentials", group: "configuration" },
  { icon: Calculator, label: "Price Estimator", path: "/job-estimator", group: "configuration" },
  { icon: Route, label: "Route Planner", path: "/routes", group: "configuration" },
  { icon: Shield, label: "Trust & Safety", path: "/trust-safety", group: "configuration" },

  // —— Administration
  { icon: ShieldAlert, label: "Moderation", path: "/admin/moderation", group: "administration", adminOnly: true },
  { icon: Shield, label: "Control Center", path: "/admin", group: "administration", adminOnly: true },
  { icon: Percent, label: "Fee management", path: "/admin/fees", group: "administration", adminOnly: true },
  { icon: Landmark, label: "Tax Rules", path: "/admin/tax-rules", group: "administration", adminOnly: true },

  // —— Labs — unfinished / partner-dependent (honest · Soon)
  { icon: ShieldCheck, label: "Job Holds · Soon", path: "/escrow", group: "labs", beta: true },
  { icon: Tag, label: "Local Deals · Soon", path: "/deals", group: "labs", beta: true },
  { icon: Siren, label: "Emergency Board", path: "/emergency", group: "labs" },
  { icon: PhoneCall, label: "Phone Scripts", path: "/phone", group: "labs" },
  { icon: Palette, label: "Design System", path: "/design-system", group: "labs" },
];

export const NAV_GROUP_META = {
  live: { label: "Live", collapsible: false, defaultOpen: true },
  history: { label: "History", collapsible: true, defaultOpen: true },
  analytics: { label: "Analytics", collapsible: true, defaultOpen: false },
  reports: { label: "Reports", collapsible: true, defaultOpen: false },
  communication: { label: "Communication", collapsible: true, defaultOpen: true },
  ai: { label: "AI", collapsible: true, defaultOpen: false },
  configuration: { label: "Configuration", collapsible: true, defaultOpen: false },
  administration: { label: "Administration", collapsible: true, defaultOpen: false },
  labs: { label: "Labs", collapsible: true, defaultOpen: false },
};

export const NAV_GROUP_ORDER = [
  "live",
  "history",
  "analytics",
  "reports",
  "communication",
  "ai",
  "configuration",
  "administration",
  "labs",
];

/** Mobile bottom tabs — Live + Communication roots. */
export const MOBILE_TAB_ITEMS = [
  { icon: Car, label: "Driver", path: "/driver" },
  { icon: Radio, label: "TitanCom", path: "/comms" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: User, label: "Profile", path: "/profile" },
];

/** Paths that keep the bottom tab bar “selected root” chrome (no Back). */
export const MOBILE_ROOT_PATHS = ["/", "/driver", "/comms", "/jobs", "/marketplace", "/messages", "/profile", "/more"];

/**
 * More menu — OS domains. Tabs cover primary Live + Communication; More holds the rest.
 */
export const MORE_MENU_GROUPS = [
  {
    title: "Live",
    description: "What is happening now",
    paths: ["/driver", "/", "/jobs", "/schedule", "/marketplace", "/hire", "/booking"],
  },
  {
    title: "History",
    description: "People and past work records",
    paths: ["/customers", "/estimates", "/invoices", "/leads", "/contracts", "/insurance"],
  },
  {
    title: "Analytics",
    description: "Understand performance",
    paths: ["/analytics", "/reputation", "/titan-score"],
  },
  {
    title: "Reports",
    description: "Money, tax, and exports",
    paths: ["/reports", "/finances", "/payments", "/tax-center", "/receipts"],
  },
  {
    title: "Communication",
    description: "Talk to customers and your team",
    paths: ["/comms", "/messages", "/community", "/notifications", "/follow-ups"],
  },
  {
    title: "AI",
    description: "Assistants and coaching",
    paths: ["/assistant", "/marketing", "/growth-coach"],
  },
  {
    title: "Configuration",
    description: "Setup for you, your business, and assets",
    paths: [
      "/settings",
      "/profile",
      "/companies",
      "/fleet",
      "/employees",
      "/inventory",
      "/credentials",
      "/job-estimator",
      "/routes",
      "/trust-safety",
    ],
  },
  {
    title: "Administration",
    description: "Platform controls",
    paths: ["/admin", "/admin/moderation", "/admin/fees", "/admin/tax-rules"],
  },
  {
    title: "Labs",
    description: "Early tools — not production-complete",
    paths: ["/escrow", "/deals", "/emergency", "/phone", "/design-system"],
  },
];

export const QUICK_CREATE_ACTIONS = [
  { label: "New Job", path: "/jobs?new=1", icon: Briefcase },
  { label: "Create Estimate", path: "/estimates?new=1", icon: FileText },
  { label: "Invoice", path: "/invoices?new=1", icon: Receipt },
  { label: "Customer", path: "/customers?new=1", icon: Users },
  { label: "Post a haul", path: "/hire?new=1", icon: UserPlus },
];

/** Map path → OS domain id for chrome / breadcrumbs. */
export function resolveNavDomain(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  const item =
    APP_NAV_ITEMS.find((n) => n.path === path) ||
    APP_NAV_ITEMS.find((n) => n.path !== "/" && path.startsWith(`${n.path}/`));
  return item?.group || "live";
}

export function navItemsByPaths(paths) {
  return paths
    .map((path) => APP_NAV_ITEMS.find((item) => item.path === path))
    .filter(Boolean);
}

/** Filter nav for the current user (hide admin-only unless admin). */
export function filterNavItems(items, { isAdmin = false } = {}) {
  return items.filter((item) => !item.adminOnly || isAdmin);
}

/**
 * Resolve a human page title for chrome (MobileHeader, breadcrumbs).
 * Prefer specific nested titles over generic section labels.
 */
export function resolvePageTitle(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";

  if (path === "/") return "Command Center";
  if (path === "/more") return "More";
  if (path.startsWith("/driver/trip")) return "Trip detail";
  if (path.startsWith("/driver/") && path !== "/driver") return "Driver profile";
  if (path.startsWith("/customers/") && path !== "/customers") return "Customer";
  if (path.startsWith("/invoices/") && path !== "/invoices") return "Invoice";
  if (path.startsWith("/features/")) return "Feature";
  if (path.startsWith("/admin/moderation")) return "Moderation";
  if (path === "/admin") return "Control Center";
  if (path.startsWith("/admin/fees")) return "Fee management";
  if (path.startsWith("/admin/tax-rules")) return "Tax Rules";
  if (path.startsWith("/book/")) return "Booking";
  if (path.startsWith("/u/")) return "Public profile";
  if (path.startsWith("/sign/")) return "Sign document";

  const exact = APP_NAV_ITEMS.find((item) => item.path === path);
  if (exact) return exact.label.replace(/\s·\sSoon$/, "");

  const tab = MOBILE_TAB_ITEMS.find((item) => item.path === path);
  if (tab) return tab.label === "Driver" ? "Driver Hub" : tab.label;

  const prefix = APP_NAV_ITEMS.find(
    (item) => item.path !== "/" && path.startsWith(`${item.path}/`)
  );
  if (prefix) return prefix.label.replace(/\s·\sSoon$/, "");

  return "TitanOS";
}

/** Parent crumb for nested routes — domain list or section root. */
export function resolveNavParent(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path.startsWith("/driver")) return { label: "Driver Hub", path: "/driver" };
  if (path.startsWith("/customers")) return { label: "Customers", path: "/customers" };
  if (path.startsWith("/invoices")) return { label: "Invoices", path: "/invoices" };
  if (path.startsWith("/jobs")) return { label: "Jobs", path: "/jobs" };
  if (path.startsWith("/estimates")) return { label: "Estimates", path: "/estimates" };
  if (path.startsWith("/marketplace")) return { label: "Marketplace", path: "/marketplace" };
  if (path.startsWith("/messages")) return { label: "Messages", path: "/messages" };
  if (path.startsWith("/comms")) return { label: "TitanCom", path: "/comms" };
  if (path.startsWith("/assistant")) return { label: "AI", path: "/assistant" };
  if (path.startsWith("/settings") || path.startsWith("/trust-safety")) {
    return { label: "More", path: "/more" };
  }
  if (path.startsWith("/profile") || path.startsWith("/titan-score")) {
    return { label: "Profile", path: "/profile" };
  }
  if (path.startsWith("/admin")) return { label: "More", path: "/more" };
  return { label: "More", path: "/more" };
}
