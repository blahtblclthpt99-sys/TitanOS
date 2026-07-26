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
  Gift,
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
 * Sidebar IA — daily work first; Labs holds demos / early tools (collapsed).
 * Items with adminOnly are filtered in Sidebar / MoreMenu.
 */
export const APP_NAV_ITEMS = [
  // Daily work — Driver Hub is #1
  { icon: Car, label: "Driver Hub", path: "/driver", group: "daily" },
  { icon: Radio, label: "TitanCom", path: "/comms", group: "daily" },
  { icon: LayoutDashboard, label: "Command Center", path: "/", group: "daily" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "daily" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "daily" },
  { icon: Users, label: "Customers", path: "/customers", group: "daily" },
  { icon: FileText, label: "Estimates", path: "/estimates", group: "daily" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "daily" },
  { icon: MessageSquare, label: "Messages", path: "/messages", group: "daily" },

  // Money
  { icon: DollarSign, label: "Finances", path: "/finances", group: "money" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "money" },
  { icon: ClipboardList, label: "1099 Tax Center", path: "/tax-center", group: "money" },
  { icon: ScanLine, label: "Receipt Scanner", path: "/receipts", group: "money" },
  { icon: LineChart, label: "Analytics", path: "/analytics", group: "money" },
  { icon: BarChart3, label: "Reports", path: "/reports", group: "money" },

  // Field & team
  { icon: Calculator, label: "Price Estimator", path: "/job-estimator", group: "field" },
  { icon: Route, label: "Route Planner", path: "/routes", group: "field" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "field" },
  { icon: UserCog, label: "Employees", path: "/employees", group: "field" },
  { icon: Package, label: "Inventory", path: "/inventory", group: "field" },
  { icon: BadgeCheck, label: "Credentials", path: "/credentials", group: "field" },
  { icon: CalendarCheck, label: "Booking", path: "/booking", group: "field" },
  { icon: FileSignature, label: "Contracts", path: "/contracts", group: "field" },

  // Growth — live customer / revenue tools
  { icon: Store, label: "Marketplace", path: "/marketplace", group: "growth" },
  { icon: UserPlus, label: "Hire Workers", path: "/hire", group: "growth" },
  { icon: ContactRound, label: "Leads", path: "/leads", group: "growth" },
  { icon: MessageSquare, label: "Follow-ups", path: "/follow-ups", group: "growth" },
  { icon: Star, label: "Reputation", path: "/reputation", group: "growth" },
  { icon: Megaphone, label: "AI Marketing", path: "/marketing", group: "growth" },
  { icon: Award, label: "Titan Score", path: "/titan-score", group: "growth" },
  { icon: Gift, label: "Referrals", path: "/referral", group: "growth" },

  // Connect
  { icon: Bot, label: "Titan AI", path: "/assistant", group: "connect" },
  { icon: UsersRound, label: "Community", path: "/community", group: "connect" },
  { icon: Bell, label: "Notifications", path: "/notifications", group: "connect" },

  // Account
  { icon: User, label: "Professional Profile", path: "/profile", group: "account" },
  { icon: Building2, label: "Companies", path: "/companies", group: "account" },
  { icon: Settings, label: "Settings", path: "/settings", group: "account" },
  { icon: Shield, label: "Trust & Safety", path: "/trust-safety", group: "account" },
  { icon: ShieldAlert, label: "Moderation", path: "/admin/moderation", group: "account", adminOnly: true },
  { icon: Percent, label: "Fee management", path: "/admin/fees", group: "account", adminOnly: true },
  { icon: Landmark, label: "Tax Rules", path: "/admin/tax-rules", group: "account", adminOnly: true },

  // Labs — needs external providers (Stripe Connect, Twilio, partner feeds)
  { icon: ShieldCheck, label: "Job Holds · Soon", path: "/escrow", group: "labs", beta: true },
  { icon: Sparkles, label: "Growth Coach", path: "/growth-coach", group: "labs" },
  { icon: Tag, label: "Local Deals · Soon", path: "/deals", group: "labs", beta: true },
  { icon: Siren, label: "Emergency Board", path: "/emergency", group: "labs" },
  { icon: PhoneCall, label: "Phone Scripts", path: "/phone", group: "labs" },
  { icon: Shield, label: "Insurance", path: "/insurance", group: "labs" },
  { icon: Palette, label: "Design System", path: "/design-system", group: "labs" },
];

export const NAV_GROUP_META = {
  daily: { label: "Daily work", collapsible: false, defaultOpen: true },
  money: { label: "Money", collapsible: true, defaultOpen: true },
  field: { label: "Field & team", collapsible: true, defaultOpen: false },
  growth: { label: "Grow business", collapsible: true, defaultOpen: false },
  connect: { label: "Connect", collapsible: true, defaultOpen: false },
  account: { label: "Account", collapsible: true, defaultOpen: false },
  labs: { label: "Labs", collapsible: true, defaultOpen: false },
};

export const NAV_GROUP_ORDER = ["daily", "money", "field", "growth", "connect", "account", "labs"];

/** Mobile bottom tabs — Driver Hub is #1. */
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
 * More menu — essentials first; Labs holds partner-dependent tools.
 */
export const MORE_MENU_GROUPS = [
  {
    title: "Daily work",
    description: "Run today’s jobs",
    paths: ["/driver", "/comms", "/", "/schedule", "/customers", "/estimates", "/invoices", "/messages"],
  },
  {
    title: "Money",
    description: "Get paid and stay organized",
    paths: ["/finances", "/payments", "/tax-center", "/receipts", "/analytics", "/reports"],
  },
  {
    title: "Field & team",
    description: "Crew, routes, fleet",
    paths: [
      "/job-estimator",
      "/routes",
      "/fleet",
      "/employees",
      "/inventory",
      "/credentials",
      "/booking",
      "/contracts",
    ],
  },
  {
    title: "Grow",
    description: "Find work and customers",
    paths: ["/marketplace", "/hire", "/leads", "/follow-ups", "/reputation", "/referral", "/marketing", "/titan-score"],
  },
  {
    title: "Connect",
    description: "Talk to customers and your team",
    paths: ["/assistant", "/community", "/notifications"],
  },
  {
    title: "Account",
    description: "You and your business",
    paths: ["/profile", "/companies", "/settings", "/trust-safety", "/admin/moderation", "/admin/fees", "/admin/tax-rules"],
  },
  {
    title: "Labs",
    description: "Tools that need partner APIs (Stripe Connect, telephony, deals)",
    paths: [
      "/escrow",
      "/growth-coach",
      "/deals",
      "/emergency",
      "/phone",
      "/insurance",
      "/design-system",
    ],
  },
];

export const QUICK_CREATE_ACTIONS = [
  { label: "New Job", path: "/jobs?new=1", icon: Briefcase },
  { label: "Create Estimate", path: "/estimates?new=1", icon: FileText },
  { label: "Invoice", path: "/invoices?new=1", icon: Receipt },
  { label: "Customer", path: "/customers?new=1", icon: Users },
  { label: "Post a haul", path: "/hire?new=1", icon: UserPlus },
];

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

/** Parent crumb for nested routes — More or section list. */
export function resolveNavParent(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path.startsWith("/driver")) return { label: "Driver Hub", path: "/driver" };
  if (path.startsWith("/customers")) return { label: "Customers", path: "/customers" };
  if (path.startsWith("/invoices")) return { label: "Invoices", path: "/invoices" };
  if (path.startsWith("/jobs")) return { label: "Jobs", path: "/jobs" };
  if (path.startsWith("/estimates")) return { label: "Estimates", path: "/estimates" };
  if (path.startsWith("/marketplace")) return { label: "Marketplace", path: "/marketplace" };
  if (path.startsWith("/messages")) return { label: "Messages", path: "/messages" };
  if (path.startsWith("/settings") || path.startsWith("/trust-safety")) {
    return { label: "More", path: "/more" };
  }
  if (path.startsWith("/profile") || path.startsWith("/titan-score")) {
    return { label: "Profile", path: "/profile" };
  }
  return { label: "More", path: "/more" };
}
