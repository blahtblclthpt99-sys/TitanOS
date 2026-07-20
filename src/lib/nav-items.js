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
} from "lucide-react";

/**
 * Sidebar IA — daily work first; secondary groups collapsed by default.
 * Items with adminOnly are filtered in Sidebar / MoreMenu.
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
  { icon: ShieldCheck, label: "Job Holds · Beta", path: "/escrow", group: "money", beta: true },
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

  // Growth
  { icon: Store, label: "Marketplace", path: "/marketplace", group: "growth" },
  { icon: UserPlus, label: "Hire Workers", path: "/hire", group: "growth" },
  { icon: ContactRound, label: "Leads", path: "/leads", group: "growth" },
  { icon: MessageSquare, label: "Follow-ups", path: "/follow-ups", group: "growth" },
  { icon: Star, label: "Reputation", path: "/reputation", group: "growth" },
  { icon: Sparkles, label: "Growth Coach · Beta", path: "/growth-coach", group: "growth", beta: true },
  { icon: Megaphone, label: "AI Marketing", path: "/marketing", group: "growth" },
  { icon: Award, label: "Titan Score", path: "/titan-score", group: "growth" },
  { icon: Tag, label: "Local Deals · Beta", path: "/deals", group: "growth", beta: true },
  { icon: Siren, label: "Emergency Jobs", path: "/emergency", group: "growth" },
  { icon: Shield, label: "Insurance", path: "/insurance", group: "growth" },
  { icon: Gift, label: "Referrals", path: "/referral", group: "growth" },

  // Connect
  { icon: Bot, label: "AI Assistant", path: "/assistant", group: "connect" },
  { icon: PhoneCall, label: "Phone Script · Beta", path: "/phone", group: "connect", beta: true },
  { icon: MessageSquare, label: "Messages", path: "/messages", group: "connect" },
  { icon: UsersRound, label: "Community", path: "/community", group: "connect" },
  { icon: Bell, label: "Notifications", path: "/notifications", group: "connect" },

  // Account
  { icon: User, label: "Professional Profile", path: "/profile", group: "account" },
  { icon: Shield, label: "Trust & Safety · Beta", path: "/trust-safety", group: "account", beta: true },
  { icon: Building2, label: "Companies", path: "/companies", group: "account" },
  { icon: Settings, label: "Settings", path: "/settings", group: "account" },
  { icon: Palette, label: "Design System", path: "/design-system", group: "account" },
  { icon: ShieldAlert, label: "Moderation", path: "/admin/moderation", group: "account", adminOnly: true },
];

export const NAV_GROUP_META = {
  daily: { label: "Daily work", collapsible: false, defaultOpen: true },
  money: { label: "Money", collapsible: true, defaultOpen: true },
  field: { label: "Field & team", collapsible: true, defaultOpen: false },
  growth: { label: "Grow business", collapsible: true, defaultOpen: false },
  connect: { label: "Connect", collapsible: true, defaultOpen: false },
  account: { label: "Account", collapsible: true, defaultOpen: false },
};

export const NAV_GROUP_ORDER = ["daily", "money", "field", "growth", "connect", "account"];

/** Mobile bottom tabs — Settings (not “Profile”) to match destination */
export const MOBILE_TAB_ITEMS = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: Store, label: "Market", path: "/marketplace" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

/** Paths that keep the bottom tab bar “selected root” chrome (no Back). */
export const MOBILE_ROOT_PATHS = ["/", "/jobs", "/marketplace", "/messages", "/settings", "/more"];

/**
 * More menu — essentials first; beta tools labeled in APP_NAV_ITEMS.
 * Driver Hub lives in Daily work (no duplicate hero).
 */
export const MORE_MENU_GROUPS = [
  {
    title: "Daily work",
    description: "Run today’s jobs",
    paths: ["/driver", "/schedule", "/customers", "/estimates", "/invoices"],
  },
  {
    title: "Money",
    description: "Get paid and stay organized",
    paths: ["/finances", "/payments", "/tax-center", "/receipts", "/invoices", "/analytics", "/reports", "/escrow"],
  },
  {
    title: "Field & team",
    description: "Crew, trucks, and ops",
    paths: ["/job-estimator", "/routes", "/fleet", "/employees", "/inventory", "/credentials", "/booking", "/contracts"],
  },
  {
    title: "Grow",
    description: "Find work and customers",
    paths: ["/marketplace", "/hire", "/leads", "/follow-ups", "/reputation", "/referral", "/marketing", "/titan-score"],
  },
  {
    title: "Connect",
    description: "Talk to customers and your team",
    paths: ["/assistant", "/messages", "/community", "/notifications"],
  },
  {
    title: "Account",
    description: "You and your business",
    paths: ["/profile", "/companies", "/settings", "/design-system", "/trust-safety", "/admin/moderation"],
  },
  {
    title: "Labs",
    description: "Early / experimental tools",
    paths: ["/growth-coach", "/deals", "/emergency", "/phone", "/insurance"],
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
