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
  Award,
  Megaphone,
  Tag,
  Siren,
  ShieldCheck,
  PhoneCall,
  Car,
} from "lucide-react";

/**
 * Sidebar IA — fewer groups, daily work first.
 * Groups other than `daily` are collapsible in the sidebar.
 */
export const APP_NAV_ITEMS = [
  // Daily work — always visible
  { icon: LayoutDashboard, label: "Command Center", path: "/", group: "daily" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", group: "daily" },
  { icon: Calendar, label: "Schedule", path: "/schedule", group: "daily" },
  { icon: Users, label: "Customers", path: "/customers", group: "daily" },
  { icon: FileText, label: "Estimates", path: "/estimates", group: "daily" },
  { icon: Receipt, label: "Invoices", path: "/invoices", group: "daily" },
  { icon: Car, label: "Driver Hub", path: "/driver", group: "daily" },

  // Money
  { icon: DollarSign, label: "Finances", path: "/finances", group: "money" },
  { icon: CreditCard, label: "Payments", path: "/payments", group: "money" },
  { icon: ShieldCheck, label: "Payment Protection", path: "/escrow", group: "money" },
  { icon: ClipboardList, label: "1099 Tax Center", path: "/tax-center", group: "money" },
  { icon: ScanLine, label: "Receipt Scanner", path: "/receipts", group: "money" },
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

  // Growth
  { icon: Store, label: "Marketplace", path: "/marketplace", group: "growth" },
  { icon: UserPlus, label: "Hire Workers", path: "/hire", group: "growth" },
  { icon: ContactRound, label: "Leads", path: "/leads", group: "growth" },
  { icon: MessageSquare, label: "Follow-ups", path: "/follow-ups", group: "growth" },
  { icon: Star, label: "Reputation", path: "/reputation", group: "growth" },
  { icon: Sparkles, label: "Growth Coach", path: "/growth-coach", group: "growth" },
  { icon: Megaphone, label: "AI Marketing", path: "/marketing", group: "growth" },
  { icon: Award, label: "Titan Score", path: "/titan-score", group: "growth" },
  { icon: Tag, label: "Local Deals", path: "/deals", group: "growth" },
  { icon: Siren, label: "Emergency Jobs", path: "/emergency", group: "growth" },
  { icon: Shield, label: "Insurance", path: "/insurance", group: "growth" },
  { icon: Gift, label: "Referrals", path: "/referral", group: "growth" },

  // Connect
  { icon: Bot, label: "AI Assistant", path: "/assistant", group: "connect" },
  { icon: PhoneCall, label: "Phone Receptionist", path: "/phone", group: "connect" },
  { icon: UsersRound, label: "Community", path: "/community", group: "connect" },
  { icon: Bell, label: "Notifications", path: "/notifications", group: "connect" },

  // Account
  { icon: Building2, label: "Companies", path: "/companies", group: "account" },
  { icon: Settings, label: "Settings", path: "/settings", group: "account" },
  { icon: ShieldAlert, label: "Moderation", path: "/admin/moderation", group: "account" },
];

export const NAV_GROUP_META = {
  daily: { label: "Daily work", collapsible: false, defaultOpen: true },
  money: { label: "Money", collapsible: true, defaultOpen: true },
  field: { label: "Field & team", collapsible: true, defaultOpen: false },
  growth: { label: "Grow business", collapsible: true, defaultOpen: false },
  connect: { label: "Connect", collapsible: true, defaultOpen: false },
  account: { label: "Account", collapsible: true, defaultOpen: false },
};

/** @deprecated use NAV_GROUP_META */
export const NAV_GROUP_LABELS = Object.fromEntries(
  Object.entries(NAV_GROUP_META).map(([id, meta]) => [id, meta.label])
);

export const NAV_GROUP_ORDER = ["daily", "money", "field", "growth", "connect", "account"];

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
    title: "Daily work",
    paths: ["/driver", "/schedule", "/customers", "/estimates", "/invoices"],
  },
  {
    title: "Money",
    paths: ["/finances", "/payments", "/escrow", "/tax-center", "/receipts", "/reports"],
  },
  {
    title: "Field & team",
    paths: ["/job-estimator", "/routes", "/fleet", "/employees", "/inventory", "/credentials", "/booking", "/contracts"],
  },
  {
    title: "Grow business",
    paths: ["/marketplace", "/hire", "/leads", "/follow-ups", "/reputation", "/growth-coach", "/marketing", "/titan-score", "/deals", "/emergency", "/insurance", "/referral"],
  },
  {
    title: "Connect",
    paths: ["/assistant", "/phone", "/community", "/notifications"],
  },
  {
    title: "Account",
    paths: ["/companies", "/settings", "/admin/moderation"],
  },
];

export const QUICK_CREATE_ACTIONS = [
  { label: "Driver Hub", path: "/driver", icon: Car },
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
