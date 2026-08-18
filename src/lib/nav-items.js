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
  UserRoundCog,
  Truck,
  Package,
  FolderKanban,
  MoreHorizontal,
} from "lucide-react";

/**
 * TitanOS primary navigation.
 *
 * Product rule: TitanOS is a Business Operating System first.
 * Jobs, customers, scheduling, estimates, invoices, payments, people, fleet,
 * inventory, and business records are the core product. Growth and intelligence
 * are extensions layered on top of that operating system, not equal competing apps.
 */
export const APP_NAV_ITEMS = [
  // OPERATIONS — the daily business OS
  { icon: LayoutDashboard, label: "Business Home", path: "/", group: "operations" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "operations" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "operations" },
  { icon: Users, label: "Customers", path: "/customers", group: "operations" },

  // SALES & MONEY
  { icon: FileText, label: "Estimates", path: "/estimates", group: "money" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "money" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "money" },

  // BUSINESS MANAGEMENT
  { icon: UserRoundCog, label: "Employees", path: "/employees", group: "management" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "management" },
  { icon: Package, label: "Inventory", path: "/inventory", group: "management" },
  { icon: FolderKanban, label: "Business Documents", path: "/business-documents", group: "management" },

  // EXTENSIONS — useful, but intentionally secondary to running the business
  { icon: Briefcase, label: "Find Work", path: "/hire/matches", group: "extensions" },
  { icon: Workflow, label: "Titan Auto + Leads", path: "/autopilot", group: "extensions" },
  { icon: Brain, label: "2nd Self", path: "/second-me", group: "extensions" },
];

/**
 * Preserved internal workflows and utilities. These remain reachable without
 * becoming top-level product destinations.
 */
export const INTERNAL_WORKFLOW_ITEMS = [
  { label: "Fleet Operations", path: "/driver", group: "management", hidden: true },
  { label: "Route Planner", path: "/routes", group: "management", hidden: true },
  { label: "Credentials", path: "/credentials", group: "management", hidden: true },
  { label: "Contracts", path: "/contracts", group: "management", hidden: true },
  { label: "Insurance", path: "/insurance", group: "management", hidden: true },
  { label: "Titan AI", path: "/assistant", group: "extensions", hidden: true },
  { label: "Leads", path: "/leads", group: "extensions", hidden: true },
  { label: "Follow-ups", path: "/follow-ups", group: "extensions", hidden: true },
  { label: "Job Match Profile", path: "/hire/matches", group: "extensions", hidden: true },
  { label: "Match-ready job", path: "/hire/post-match-ready", group: "operations", hidden: true },
  { label: "Profile", path: "/profile", group: "utilities", hidden: true },
  { label: "Settings", path: "/settings", group: "utilities", hidden: true },
  { label: "Subscription", path: "/subscription", group: "utilities", hidden: true },
  { label: "Titan Support", path: "/support", group: "utilities", hidden: true },
  { label: "Trust & Safety", path: "/trust-safety", group: "utilities", hidden: true },
];

export const INTERNAL_WORKFLOW_GROUPS = [
  {
    title: "Business utilities",
    paths: [
      "/driver",
      "/routes",
      "/credentials",
      "/contracts",
      "/insurance",
      "/assistant",
      "/leads",
      "/follow-ups",
      "/hire/post-match-ready",
      "/hire/candidates",
      "/hire/find-workers",
      "/profile",
      "/settings",
      "/subscription",
      "/support",
      "/trust-safety",
    ],
  },
];

export const NAV_GROUP_META = {
  operations: { label: "Operations", collapsible: false, defaultOpen: true },
  money: { label: "Sales & Money", collapsible: false, defaultOpen: true },
  management: { label: "Business Management", collapsible: false, defaultOpen: true },
  extensions: { label: "Growth & Intelligence", collapsible: false, defaultOpen: true },
};

export const NAV_GROUP_ORDER = ["operations", "money", "management", "extensions"];

/** Mobile prioritizes daily business work. Secondary tools live under More. */
export const MOBILE_TAB_ITEMS = [
  { icon: Building2, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: Receipt, label: "Money", path: "/invoices" },
  { icon: MoreHorizontal, label: "More", path: "/more" },
];

export const MOBILE_ROOT_PATHS = MOBILE_TAB_ITEMS.map((item) => item.path);

export const MORE_MENU_GROUPS = [
  {
    title: "Run the business",
    description: "Daily operations, money, people, fleet, inventory, and records.",
    paths: [
      "/schedule",
      "/estimates",
      "/payments",
      "/employees",
      "/fleet",
      "/inventory",
      "/business-documents",
    ],
  },
  {
    title: "Growth & intelligence",
    description: "Optional tools that extend the business OS.",
    paths: ["/hire/matches", "/autopilot", "/second-me"],
  },
];

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
  if (path.startsWith("/driver") || path.startsWith("/routes")) return "management";
  if (path.startsWith("/credentials") || path.startsWith("/contracts") || path.startsWith("/insurance")) return "management";
  if (path.startsWith("/hire") || path.startsWith("/second-me") || path.startsWith("/assistant")) return "extensions";
  if (path.startsWith("/autopilot") || path.startsWith("/leads") || path.startsWith("/follow-ups")) return "extensions";
  if (path.startsWith("/invoices") || path.startsWith("/estimates") || path.startsWith("/payments")) return "money";
  return "operations";
}

export function navItemsByPaths(paths) {
  return paths.map((path) => APP_NAV_ITEMS.find((item) => item.path === path)).filter(Boolean);
}

export function filterNavItems(items) {
  return items;
}

const LEGACY_TITLES = {
  "/more": "Business Tools",
  "/notifications": "Notifications",
  "/driver": "Fleet Operations",
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
  if (path.startsWith("/driver")) return "Fleet Operations";
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
  if (path.startsWith("/driver") || path.startsWith("/routes")) return { label: "Fleet", path: "/fleet" };
  if (path.startsWith("/credentials") || path.startsWith("/contracts") || path.startsWith("/insurance")) {
    return { label: "Business Documents", path: "/business-documents" };
  }
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
  if (path.startsWith("/employees")) return { label: "Employees", path: "/employees" };
  if (path.startsWith("/fleet")) return { label: "Fleet", path: "/fleet" };
  if (path.startsWith("/inventory")) return { label: "Inventory", path: "/inventory" };
  return { label: "Business Home", path: "/" };
}
