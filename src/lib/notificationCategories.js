import {
  Briefcase,
  MessageSquare,
  Star,
  ShieldAlert,
  Sparkles,
  Bell,
} from "lucide-react";

/** Icon + accent helpers for notification categories. */
export const CATEGORY_ICONS = {
  jobs: Briefcase,
  messages: MessageSquare,
  reviews: Star,
  account: ShieldAlert,
  system: Sparkles,
  all: Bell,
};

export function categoryIcon(categoryId) {
  return CATEGORY_ICONS[categoryId] || Bell;
}

export function categoryAccentClass(categoryId, unread = true) {
  if (!unread) return "bg-muted text-muted-foreground";
  switch (categoryId) {
    case "jobs":
      return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
    case "messages":
      return "bg-titan-cyan/15 text-titan-cyan";
    case "reviews":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "account":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "system":
      return "bg-violet-500/15 text-violet-600 dark:text-violet-400";
    default:
      return "bg-titan-cyan/15 text-titan-cyan";
  }
}
