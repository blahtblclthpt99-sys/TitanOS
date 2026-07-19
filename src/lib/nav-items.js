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
} from "lucide-react";

/** Full TitanOS navigation — field ops + marketplace platform. */
export const APP_NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", group: "core" },
  { icon: Users, label: "Customers", path: "/customers", group: "core" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "core" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "ops" },
  { icon: FileText, label: "Estimates", path: "/estimates", group: "ops" },
  { icon: Calculator, label: "Price Estimator", path: "/job-estimator", group: "ops" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "ops" },
  { icon: DollarSign, label: "Finances", path: "/finances", group: "ops" },
  { icon: ClipboardList, label: "1099 Tax Center", path: "/tax-center", group: "ops" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "ops" },
  { icon: CalendarCheck, label: "Booking", path: "/booking", group: "ops" },
  { icon: FileSignature, label: "Contracts", path: "/contracts", group: "ops" },
  { icon: Route, label: "Route Planner", path: "/routes", group: "ops" },
  { icon: ScanLine, label: "Receipt Scanner", path: "/receipts", group: "ops" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "growth" },
  { icon: BarChart3, label: "Reports", path: "/reports", group: "insights" },
  { icon: Bot, label: "AI Assistant", path: "/assistant", group: "insights" },
  { icon: UsersRound, label: "Community", path: "/community", group: "insights" },
  { icon: Bell, label: "Notifications", path: "/notifications", group: "insights" },
  { icon: Store, label: "Marketplace", path: "/marketplace", group: "growth" },
  { icon: UserPlus, label: "Hire Workers", path: "/hire", group: "growth" },
  { icon: Shield, label: "Insurance", path: "/insurance", group: "growth" },
  { icon: Gift, label: "Referrals", path: "/referral", group: "growth" },
  { icon: Building2, label: "Companies", path: "/companies", group: "account" },
  { icon: Settings, label: "Settings", path: "/settings", group: "account" },
  { icon: ShieldAlert, label: "Moderation", path: "/admin/moderation", group: "account" },
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
    paths: ["/schedule", "/estimates", "/job-estimator", "/finances", "/tax-center", "/fleet", "/booking", "/contracts", "/routes", "/receipts"],
  },
  {
    title: "Insights",
    paths: ["/reports", "/assistant", "/community", "/notifications"],
  },
  {
    title: "Growth",
    paths: ["/marketplace", "/hire", "/insurance", "/referral", "/payments"],
  },
  {
    title: "Account",
    paths: ["/settings", "/companies", "/admin/moderation"],
  },
];

export function navItemsByPaths(paths) {
  return paths
    .map((path) => APP_NAV_ITEMS.find((item) => item.path === path))
    .filter(Boolean);
}
