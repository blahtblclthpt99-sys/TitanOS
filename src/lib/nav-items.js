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
  Package,
  UserCog,
  MessageSquare,
  Star,
  BadgeCheck,
  ContactRound,
  Sparkles,
  User,
} from "lucide-react";

/** Full TitanOS navigation — field ops + marketplace platform. */
export const APP_NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Command Center", path: "/", group: "core" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "core" },
  { icon: Users, label: "Customers", path: "/customers", group: "core" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "ops" },
  { icon: FileText, label: "Estimates", path: "/estimates", group: "ops" },
  { icon: Calculator, label: "Price Estimator", path: "/job-estimator", group: "ops" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "ops" },
  { icon: DollarSign, label: "Finances", path: "/finances", group: "ops" },
  { icon: ClipboardList, label: "1099 Tax Center", path: "/tax-center", group: "ops" },
  { icon: Truck, label: "Fleet", path: "/fleet", group: "ops" },
  { icon: UserCog, label: "Employees", path: "/employees", group: "ops" },
  { icon: Package, label: "Inventory", path: "/inventory", group: "ops" },
  { icon: MessageSquare, label: "Follow-ups", path: "/follow-ups", group: "growth" },
  { icon: Star, label: "Reputation", path: "/reputation", group: "growth" },
  { icon: BadgeCheck, label: "Credentials", path: "/credentials", group: "ops" },
  { icon: ContactRound, label: "Leads", path: "/leads", group: "growth" },
  { icon: Sparkles, label: "Growth Coach", path: "/growth-coach", group: "insights" },
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

export const NAV_GROUP_LABELS = {
  core: "Workspace",
  ops: "Operations",
  growth: "Growth",
  insights: "Insights",
  account: "Account",
};

/** Mobile bottom tabs — Home, Jobs, Marketplace, Messages (Community), Profile */
export const MOBILE_TAB_ITEMS = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: Store, label: "Market", path: "/marketplace" },
  { icon: UsersRound, label: "Messages", path: "/community" },
  { icon: User, label: "Profile", path: "/settings" },
];

/** Paths that keep the bottom tab bar “selected root” chrome (no Back). */
export const MOBILE_ROOT_PATHS = ["/", "/jobs", "/marketplace", "/community", "/settings", "/more"];

export const MORE_MENU_GROUPS = [
  {
    title: "Operations",
    paths: ["/schedule", "/estimates", "/job-estimator", "/invoices", "/customers", "/finances", "/tax-center", "/fleet", "/employees", "/inventory", "/credentials", "/booking", "/contracts", "/routes", "/receipts"],
  },
  {
    title: "Insights",
    paths: ["/reports", "/assistant", "/growth-coach", "/notifications"],
  },
  {
    title: "Growth",
    paths: ["/hire", "/insurance", "/referral", "/payments", "/leads", "/follow-ups", "/reputation"],
  },
  {
    title: "Account",
    paths: ["/companies", "/admin/moderation", "/more"],
  },
];

export const QUICK_CREATE_ACTIONS = [
  { label: "Create Estimate", path: "/estimates?new=1", icon: FileText },
  { label: "New Job", path: "/jobs?new=1", icon: Briefcase },
  { label: "Invoice", path: "/invoices?new=1", icon: Receipt },
  { label: "Customer", path: "/customers?new=1", icon: Users },
];

export function navItemsByPaths(paths) {
  return paths
    .map((path) => APP_NAV_ITEMS.find((item) => item.path === path))
    .filter(Boolean);
}
