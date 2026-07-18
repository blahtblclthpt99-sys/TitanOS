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
  Settings,
  Store,
  ClipboardList,
  Shield,
  Gift,
} from "lucide-react";

/** Full TitanOS navigation — original product structure for field-service ops. */
export const APP_NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", group: "core" },
  { icon: Users, label: "Customers", path: "/customers", group: "core" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "core" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "ops" },
  { icon: FileText, label: "Estimates", path: "/estimates", group: "ops" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "ops" },
  { icon: DollarSign, label: "Finances", path: "/finances", group: "ops" },
  { icon: ClipboardList, label: "1099 Tax Center", path: "/tax-center", group: "ops" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "ops" },
  { icon: BarChart3, label: "Reports", path: "/reports", group: "insights" },
  { icon: Bot, label: "AI Assistant", path: "/assistant", group: "insights" },
  { icon: Store, label: "Marketplace", path: "/marketplace", group: "growth" },
  { icon: Shield, label: "Insurance", path: "/insurance", group: "growth" },
  { icon: Gift, label: "Referrals", path: "/referral", group: "growth" },
  { icon: Settings, label: "Settings", path: "/settings", group: "account" },
];

export const MOBILE_TAB_ITEMS = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: Users, label: "Clients", path: "/customers" },
  { icon: Receipt, label: "Invoices", path: "/invoices" },
];

/** Paths that keep the bottom tab bar “selected root” chrome (no Back). */
export const MOBILE_ROOT_PATHS = ["/", "/jobs", "/customers", "/invoices", "/more"];

export const MORE_MENU_GROUPS = [
  {
    title: "Operations",
    paths: ["/schedule", "/estimates", "/finances", "/tax-center", "/fleet"],
  },
  {
    title: "Insights",
    paths: ["/reports", "/assistant"],
  },
  {
    title: "Growth",
    paths: ["/marketplace", "/insurance", "/referral"],
  },
  {
    title: "Account",
    paths: ["/settings"],
  },
];

export function navItemsByPaths(paths) {
  return paths
    .map((path) => APP_NAV_ITEMS.find((item) => item.path === path))
    .filter(Boolean);
}
