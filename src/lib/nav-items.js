import { LayoutDashboard, Briefcase, FileText, ClipboardList, User, Bot, LifeBuoy } from "lucide-react";

/**
 * TitanOS practical navigation.
 * Keep core destinations visible; merged/postponed tools remain available through
 * their canonical parent feature or compatibility routes rather than cluttering chrome.
 */
export const APP_NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Career Home", path: "/", group: "today" },
  { icon: Briefcase, label: "Find Jobs", path: "/hire", group: "work" },
  { icon: Briefcase, label: "Job Matches", path: "/hire/matches", group: "work" },
  { icon: FileText, label: "Résumé Builder", path: "/resume", group: "work" },
  { icon: ClipboardList, label: "My Applications", path: "/hire?tab=applications", group: "work" },
  { icon: Briefcase, label: "Saved Jobs", path: "/hire?tab=saved", group: "work" },
  { icon: User, label: "Career Profile", path: "/profile", group: "business" },
  { icon: Bot, label: "Career Coach", path: "/assistant", group: "business" },
  { icon: LifeBuoy, label: "Titan Support", path: "/support", group: "support" },
];

/**
 * Preserved internal workflows. These routes remain available to existing flows and
 * bookmarks but are intentionally excluded from the primary navigation and More menu.
 */
export const INTERNAL_WORKFLOW_ITEMS = [
  { label: "Job Matches", path: "/hire/matches", group: "live", hidden: true },
  { label: "Match-ready job", path: "/hire/post-match-ready", group: "live", hidden: true },
];

export const INTERNAL_WORKFLOW_GROUPS = [
  {
    title: "Hiring",
    paths: ["/hire/matches", "/hire/post-match-ready", "/hire/candidates", "/hire/find-workers"],
  },
];

export const NAV_GROUP_META = {
  today: { label: "Career Center", collapsible: false, defaultOpen: true },
  work: { label: "Job Search", collapsible: true, defaultOpen: true },
  customers: { label: "Customers", collapsible: true, defaultOpen: true },
  money: { label: "Money", collapsible: true, defaultOpen: true },
  second_me: { label: "Second Me", collapsible: true, defaultOpen: true },
  business: { label: "Career Tools", collapsible: true, defaultOpen: false },
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
  { icon: Briefcase, label: "Find Jobs", path: "/hire" },
  { icon: Briefcase, label: "Matches", path: "/hire/matches" },
  { icon: FileText, label: "Résumé", path: "/resume" },
];

export const MOBILE_ROOT_PATHS = ["/", "/hire", "/hire/matches", "/resume", "/more"];

export const MORE_MENU_GROUPS = [
  { title: "Find Work", description: "Search, save and apply", paths: ["/hire", "/hire/matches", "/hire?tab=saved", "/hire?tab=applications"] },
  { title: "Career Tools", description: "Prepare for your next job", paths: ["/resume", "/profile", "/assistant"] },
  { title: "Support", description: "Get help with TitanOS", paths: ["/support"] },
];

export const QUICK_CREATE_ACTIONS = [
  { label: "Find Jobs", path: "/hire", icon: Briefcase },
  { label: "Create Résumé", path: "/resume", icon: FileText },
  { label: "Job Matches", path: "/hire/matches", icon: Briefcase },
  { label: "My Applications", path: "/hire?tab=applications", icon: ClipboardList },
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
  if (path === "/") return "Career Home";
  if (path === "/more") return "More Career Tools";
  const item = APP_NAV_ITEMS.find((entry) => entry.path.split("?")[0] === path);
  if (item) return item.label;
  const tab = MOBILE_TAB_ITEMS.find((entry) => entry.path === path);
  if (tab) return tab.label;
  if (path.startsWith("/hire")) return "Find Jobs";
  return "TitanOS Careers";
}

export function resolveNavParent(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path === "/resume") return { label: "Résumé Builder", path: "/resume" };
  if (path === "/assistant") return { label: "Career Coach", path: "/assistant" };
  if (path.startsWith("/hire")) return { label: "Find Jobs", path: "/hire" };
  if (path === "/profile") return { label: "Career Profile", path: "/profile" };
  if (path === "/support") return { label: "Support", path: "/support" };
  return { label: "Career Home", path: "/" };
}
