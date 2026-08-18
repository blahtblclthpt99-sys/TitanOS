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
  ContactRound,
  UserRoundCog,
  Truck,
  Package,
  FolderKanban,
  MoreHorizontal,
  UserSearch,
  UserCircle,
} from "lucide-react";
import { isBusinessAccount } from "@/lib/accountExperience";

/**
 * TitanOS is two account experiences over one platform:
 * - Business: the complete Business Operating System + TitanAUTO.
 * - Job Seeker: nearby jobs, a matching profile, and TitanAUTO.
 *
 * Intelligence remains underneath both experiences instead of competing with
 * the primary work users came to Titan to do.
 */
export const APP_NAV_ITEMS = [
  // BUSINESS — daily operations
  { icon: LayoutDashboard, label: "Business Home", path: "/", group: "operations", audience: "business" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "operations", audience: "business" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "operations", audience: "business" },
  { icon: Users, label: "Customers", path: "/customers", group: "operations", audience: "business" },

  // BUSINESS — sales & money
  { icon: FileText, label: "Estimates", path: "/estimates", group: "money", audience: "business" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "money", audience: "business" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "money", audience: "business" },

  // BUSINESS — management & hiring
  { icon: UserRoundCog, label: "Employees", path: "/employees", group: "management", audience: "business" },
  { icon: UserSearch, label: "Talent", path: "/talent", group: "management", audience: "business" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "management", audience: "business" },
  { icon: Package, label: "Inventory", path: "/inventory", group: "management", audience: "business" },
  { icon: FolderKanban, label: "Business Documents", path: "/business-documents", group: "management", audience: "business" },

  // JOB SEEKER
  { icon: Briefcase, label: "Available Jobs", path: "/hire/matches", group: "seeker", audience: "job_seeker" },
  { icon: UserCircle, label: "Job Profile", path: "/job-profile", group: "seeker", audience: "job_seeker" },

  // SHARED
  { icon: Workflow, label: "TitanAUTO", path: "/autopilot", group: "shared", audience: "shared" },
];

export const INTERNAL_WORKFLOW_ITEMS = [
  { label: "Fleet Operations", path: "/driver", group: "management", hidden: true },
  { label: "Route Planner", path: "/routes", group: "management", hidden: true },
  { label: "Credentials", path: "/credentials", group: "management", hidden: true },
  { label: "Contracts", path: "/contracts", group: "management", hidden: true },
  { label: "Insurance", path: "/insurance", group: "management", hidden: true },
  { label: "2nd Self", path: "/second-me", group: "shared", hidden: true },
  { label: "Titan AI", path: "/assistant", group: "shared", hidden: true },
  { label: "Leads", path: "/leads", group: "shared", hidden: true },
  { label: "Follow-ups", path: "/follow-ups", group: "shared", hidden: true },
  { label: "Candidate matches", path: "/hire/candidates", group: "management", hidden: true },
  { label: "Recruiting posts", path: "/hire/find-workers", group: "management", hidden: true },
  { label: "Match-ready job", path: "/hire/post-match-ready", group: "management", hidden: true },
  { label: "Account Type", path: "/account-type", group: "utilities", hidden: true },
  { label: "Profile", path: "/profile", group: "utilities", hidden: true },
  { label: "Settings", path: "/settings", group: "utilities", hidden: true },
  { label: "Subscription", path: "/subscription", group: "utilities", hidden: true },
  { label: "Titan Support", path: "/support", group: "utilities", hidden: true },
  { label: "Trust & Safety", path: "/trust-safety", group: "utilities", hidden: true },
];

export const NAV_GROUP_META = {
  operations: { label: "Operations", collapsible: false, defaultOpen: true },
  money: { label: "Sales & Money", collapsible: false, defaultOpen: true },
  management: { label: "Business Management", collapsible: false, defaultOpen: true },
  seeker: { label: "Job Seeker", collapsible: false, defaultOpen: true },
  shared: { label: "Titan", collapsible: false, defaultOpen: true },
};

export const NAV_GROUP_ORDER = ["operations", "money", "management", "seeker", "shared"];

const BUSINESS_MOBILE = [
  { icon: Building2, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: Receipt, label: "Money", path: "/invoices" },
  { icon: MoreHorizontal, label: "More", path: "/more" },
];

const SEEKER_MOBILE = [
  { icon: Briefcase, label: "Jobs", path: "/hire/matches" },
  { icon: UserCircle, label: "Profile", path: "/job-profile" },
  { icon: Workflow, label: "TitanAUTO", path: "/autopilot" },
];

export function navItemsForUser(user) {
  const audience = isBusinessAccount(user) ? "business" : "job_seeker";
  return APP_NAV_ITEMS.filter((item) => item.audience === audience || item.audience === "shared");
}

export function mobileTabItemsForUser(user) {
  return isBusinessAccount(user) ? BUSINESS_MOBILE : SEEKER_MOBILE;
}

/** Kept as a compatibility export for older imports; prefer mobileTabItemsForUser. */
export const MOBILE_TAB_ITEMS = BUSINESS_MOBILE;
export const MOBILE_ROOT_PATHS = BUSINESS_MOBILE.map((item) => item.path);

export const MORE_MENU_GROUPS = [
  {
    title: "Run the business",
    description: "Daily operations, money, people, fleet, inventory, and records.",
    paths: [
      "/schedule",
      "/estimates",
      "/payments",
      "/employees",
      "/talent",
      "/fleet",
      "/inventory",
      "/business-documents",
    ],
  },
  {
    title: "Titan",
    description: "Shared automation and account utilities.",
    paths: ["/autopilot"],
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
  if (path.startsWith("/talent") || path.startsWith("/hire/candidates") || path.startsWith("/hire/find-workers") || path.startsWith("/hire/post-match-ready")) return "management";
  if (path.startsWith("/credentials") || path.startsWith("/contracts") || path.startsWith("/insurance")) return "management";
  if (path.startsWith("/hire/matches") || path.startsWith("/job-profile")) return "seeker";
  if (path.startsWith("/autopilot") || path.startsWith("/second-me") || path.startsWith("/assistant") || path.startsWith("/leads") || path.startsWith("/follow-ups")) return "shared";
  if (path.startsWith("/invoices") || path.startsWith("/estimates") || path.startsWith("/payments")) return "money";
  return "operations";
}

export function navItemsByPaths(paths) {
  return paths.map((path) => APP_NAV_ITEMS.find((item) => item.path === path)).filter(Boolean);
}

export function filterNavItems(items, { user } = {}) {
  if (!user) return items;
  const allowed = new Set(navItemsForUser(user).map((item) => item.path));
  return items.filter((item) => allowed.has(item.path));
}

const LEGACY_TITLES = {
  "/more": "Business Tools",
  "/notifications": "Notifications",
  "/driver": "Fleet Operations",
  "/routes": "Route Planner",
  "/employees": "Employees",
  "/fleet": "Fleet",
  "/talent": "Talent",
  "/inventory": "Inventory",
  "/business-documents": "Business Documents",
  "/job-profile": "Job Profile",
  "/leads": "Leads",
  "/follow-ups": "Follow-ups",
  "/assistant": "2nd Self",
  "/profile": "Profile",
  "/settings": "Settings",
  "/support": "Titan Support",
  "/trust-safety": "Trust & Safety",
  "/subscription": "Subscription",
  "/account-type": "Account Type",
};

export function resolvePageTitle(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path.startsWith("/customers/") && path !== "/customers") return "Customer";
  if (path.startsWith("/invoices/") && path !== "/invoices") return "Invoice";
  if (path.startsWith("/hire/matches")) return "Available Jobs";
  if (path.startsWith("/talent")) return "Talent";
  if (path.startsWith("/hire/candidates")) return "Candidate Matches";
  if (path.startsWith("/second-me") || path.startsWith("/assistant")) return "2nd Self";
  if (path.startsWith("/autopilot") || path.startsWith("/leads")) return "TitanAUTO";
  if (path.startsWith("/driver")) return "Fleet Operations";
  if (path.startsWith("/admin/support")) return "Support Command Center";
  if (path.startsWith("/admin/moderation")) return "Moderation";
  if (path === "/admin") return "Control Center";
  if (path.startsWith("/admin/fees")) return "Fee Management";
  if (path.startsWith("/admin/tax-rules")) return "Tax Rules";

  const exact = APP_NAV_ITEMS.find((item) => item.path === path);
  if (exact) return exact.label;
  const internal = INTERNAL_WORKFLOW_ITEMS.find((item) => item.path === path);
  if (internal) return internal.label;
  return LEGACY_TITLES[path] || "TitanOS";
}

export function resolveNavParent(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path.startsWith("/driver") || path.startsWith("/routes")) return { label: "Fleet", path: "/fleet" };
  if (path.startsWith("/talent") || path.startsWith("/hire/candidates") || path.startsWith("/hire/find-workers") || path.startsWith("/hire/post-match-ready")) return { label: "Talent", path: "/talent" };
  if (path.startsWith("/credentials") || path.startsWith("/contracts") || path.startsWith("/insurance")) return { label: "Business Documents", path: "/business-documents" };
  if (path.startsWith("/hire/matches") || path.startsWith("/job-profile")) return { label: "Available Jobs", path: "/hire/matches" };
  if (path.startsWith("/assistant") || path.startsWith("/second-me")) return { label: "TitanAUTO", path: "/autopilot" };
  if (path.startsWith("/autopilot") || path.startsWith("/leads") || path.startsWith("/follow-ups")) return { label: "TitanAUTO", path: "/autopilot" };
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
