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
  LifeBuoy,
  Brain,
  FolderOpen,
  Search,
} from "lucide-react";

export const APP_NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Career Home", path: "/", group: "career" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "career" },
  { icon: Search, label: "Opportunities", path: "/hire/matches", group: "career" },
  { icon: ClipboardList, label: "Applications", path: "/career/pipeline", group: "career" },
  { icon: User, label: "Career Profile", path: "/profile", group: "career" },
  { icon: Building2, label: "Companies", path: "/companies", group: "career" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "career" },
  { icon: Bell, label: "Notifications", path: "/notifications", group: "career" },

  { icon: Bot, label: "TitanAI Career Coach", path: "/assistant", group: "career_tools" },
  { icon: Brain, label: "Second Me", path: "/second-me", group: "career_tools" },
  { icon: Workflow, label: "Autopilot", path: "/autopilot", group: "career_tools" },

  { icon: CalendarCheck, label: "Booking", path: "/booking", group: "work_tools" },
  { icon: Users, label: "Customers", path: "/customers", group: "work_tools" },
  { icon: ContactRound, label: "Leads", path: "/leads", group: "work_tools" },
  { icon: MessageSquare, label: "Follow-ups", path: "/follow-ups", group: "work_tools" },
  { icon: Radio, label: "Communications", legacyName: "TitanCom", path: "/comms", group: "work_tools" },
  { icon: Star, label: "Reputation", path: "/reputation", group: "work_tools" },
  { icon: FileText, label: "Estimates", path: "/estimates", group: "work_tools" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "work_tools" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "work_tools" },
  { icon: DollarSign, label: "Finances", path: "/finances", group: "work_tools" },
  { icon: BarChart3, label: "Reports", path: "/reports", group: "work_tools" },
  { icon: ClipboardList, label: "Tax Center", path: "/tax-center", group: "work_tools" },

  { icon: Car, label: "Driver Hub", path: "/driver", group: "operations" },
  { icon: Route, label: "Route Planner", path: "/routes", group: "operations" },
  { icon: UserCog, label: "Employees", path: "/employees", group: "operations" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "operations" },
  { icon: Package, label: "Inventory", path: "/inventory", group: "operations" },
  { icon: FolderOpen, label: "Business Documents", path: "/business-documents", group: "operations" },
  { icon: LineChart, label: "Analytics", path: "/analytics", group: "operations" },

  { icon: Settings, label: "Settings", path: "/settings", group: "account" },
  { icon: LifeBuoy, label: "Titan Support", path: "/support", group: "account" },
  { icon: Shield, label: "Trust & Safety", path: "/trust-safety", group: "account" },

  { icon: Shield, label: "Control Center", path: "/admin", group: "administration", adminOnly: true },
  { icon: LifeBuoy, label: "Support Command Center", path: "/admin/support", group: "administration", adminOnly: true },
  { icon: ShieldAlert, label: "Moderation", path: "/admin/moderation", group: "administration", adminOnly: true },
  { icon: Percent, label: "Fee Management", path: "/admin/fees", group: "administration", adminOnly: true },
  { icon: Landmark, label: "Tax Rules", path: "/admin/tax-rules", group: "administration", adminOnly: true },
];

export const INTERNAL_WORKFLOW_ITEMS = [
  { label: "Match-ready job", path: "/hire/post-match-ready", group: "live", hidden: true },
];

export const INTERNAL_WORKFLOW_GROUPS = [{
  title: "Hiring",
  paths: ["/hire/matches", "/hire/post-match-ready", "/hire/candidates", "/hire/find-workers"],
}];

export const NAV_GROUP_META = {
  career: { label: "Jobs & Career", collapsible: false, defaultOpen: true },
  career_tools: { label: "Career Tools", collapsible: true, defaultOpen: true },
  work_tools: { label: "Work Tools", collapsible: true, defaultOpen: false },
  operations: { label: "Specialized Operations", collapsible: true, defaultOpen: false },
  account: { label: "Account & Support", collapsible: true, defaultOpen: false },
  administration: { label: "Admin", collapsible: true, defaultOpen: false },
};

export const NAV_GROUP_ORDER = ["career", "career_tools", "work_tools", "operations", "account", "administration"];

export const MOBILE_TAB_ITEMS = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: Search, label: "Matches", path: "/hire/matches" },
  { icon: ClipboardList, label: "Applications", path: "/career/pipeline" },
];

export const MOBILE_ROOT_PATHS = ["/", "/jobs", "/hire/matches", "/career/pipeline", "/more"];

export const MORE_MENU_GROUPS = [
  {
    title: "Jobs & Career",
    description: "Find work, evaluate opportunities, track applications, and strengthen your career profile",
    paths: ["/", "/jobs", "/hire/matches", "/career/pipeline", "/profile", "/companies", "/schedule", "/notifications"],
  },
  {
    title: "Career Tools",
    description: "Get user-controlled AI help with career planning and work organization",
    paths: ["/assistant", "/second-me", "/autopilot"],
  },
  {
    title: "Work Tools",
    description: "Manage clients, estimates, invoices, payments, and completed work",
    paths: ["/booking", "/customers", "/leads", "/follow-ups", "/comms", "/reputation", "/estimates", "/invoices", "/payments", "/finances", "/reports", "/tax-center"],
  },
  {
    title: "Specialized Operations",
    description: "Optional tools for driving, routing, teams, fleets, inventory, and business records",
    paths: ["/driver", "/routes", "/employees", "/fleet", "/inventory", "/business-documents", "/analytics"],
  },
  {
    title: "Account & Support",
    description: "Settings, support, privacy, and safety",
    paths: ["/settings", "/support", "/trust-safety"],
  },
  {
    title: "Admin",
    description: "Authorized staff controls",
    paths: ["/admin", "/admin/support", "/admin/moderation", "/admin/fees", "/admin/tax-rules"],
  },
];

export const QUICK_CREATE_ACTIONS = [
  { label: "Find Jobs", path: "/jobs", icon: Briefcase },
  { label: "View Matches", path: "/hire/matches", icon: Search },
  { label: "Track Applications", path: "/career/pipeline", icon: ClipboardList },
  { label: "Update Career Profile", path: "/profile", icon: User },
];

export function resolveNavDomain(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  const item = APP_NAV_ITEMS.find((n) => n.path === path) || APP_NAV_ITEMS.find((n) => n.path !== "/" && path.startsWith(`${n.path}/`));
  return item?.group || "career";
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
  if (path === "/more") return "More";
  if (path === "/career/pipeline") return "Applications";
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
  const internal = INTERNAL_WORKFLOW_ITEMS.find((item) => item.path === path);
  if (internal) return internal.label;
  const exact = APP_NAV_ITEMS.find((item) => item.path === path);
  if (exact) return exact.label;
  const tab = MOBILE_TAB_ITEMS.find((item) => item.path === path);
  if (tab) return tab.label;
  const prefix = APP_NAV_ITEMS.find((item) => item.path !== "/" && path.startsWith(`${item.path}/`));
  if (prefix) return prefix.label;
  return "TitanOS";
}

export function resolveNavParent(pathname = "/") {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path.startsWith("/jobs")) return { label: "Jobs", path: "/jobs" };
  if (path.startsWith("/career/pipeline")) return { label: "Applications", path: "/career/pipeline" };
  if (path.startsWith("/hire")) return { label: "Opportunities", path: "/hire/matches" };
  if (path.startsWith("/profile")) return { label: "Career Profile", path: "/profile" };
  if (path.startsWith("/companies")) return { label: "Companies", path: "/companies" };
  if (path.startsWith("/driver")) return { label: "Driver Hub", path: "/driver" };
  if (path.startsWith("/customers")) return { label: "Customers", path: "/customers" };
  if (path.startsWith("/invoices")) return { label: "Invoices", path: "/invoices" };
  if (path.startsWith("/estimates")) return { label: "Estimates", path: "/estimates" };
  if (path.startsWith("/comms")) return { label: "Communications", path: "/comms" };
  if (path.startsWith("/assistant")) return { label: "TitanAI Career Coach", path: "/assistant" };
  if (path.startsWith("/business-documents") || path.startsWith("/credentials") || path.startsWith("/contracts") || path.startsWith("/insurance")) return { label: "Business Documents", path: "/business-documents" };
  if (path.startsWith("/support")) return { label: "Titan Support", path: "/support" };
  if (path.startsWith("/admin")) return { label: "More", path: "/more" };
  return { label: "More", path: "/more" };
}
