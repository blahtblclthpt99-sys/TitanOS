/**
 * Marketing preference defaults and local persistence.
 * Channels: email, SMS, push · Frequency · Categories
 */
import { readLocal, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_marketing";

export const MARKETING_CHANNELS = [
  ["email", "Email marketing", "Product tips, offers, and newsletters"],
  ["sms", "SMS marketing", "Text messages about promotions and events"],
  ["push", "Push marketing", "Promotional browser/device notifications"],
];

export const MARKETING_CATEGORIES = [
  ["product", "Product updates", "New features and TitanOS improvements"],
  ["tips", "Tips & education", "How-to guides and best practices"],
  ["offers", "Offers & promotions", "Discounts, trials, and partner deals"],
  ["events", "Events & webinars", "Live sessions and community events"],
  ["partner", "Partner & marketplace", "Marketplace highlights and partner news"],
];

export const MARKETING_FREQUENCIES = [
  { id: "realtime", label: "As they happen" },
  { id: "daily", label: "Daily digest" },
  { id: "weekly", label: "Weekly summary" },
  { id: "monthly", label: "Monthly roundup" },
];

export function defaultMarketingPrefs() {
  return {
    email: true,
    sms: false,
    push: false,
    frequency: "weekly",
    categories: {
      product: true,
      tips: true,
      offers: false,
      events: false,
      partner: false,
    },
    unsubscribed_all: false,
  };
}

export function normalizeMarketingPrefs(raw) {
  const base = defaultMarketingPrefs();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    categories: {
      ...base.categories,
      ...(raw.categories || {}),
    },
  };
}

export function readLocalMarketingPrefs(userId) {
  if (!userId) return defaultMarketingPrefs();
  return normalizeMarketingPrefs(readLocal(PREFIX, userId, "prefs", null));
}

export function writeLocalMarketingPrefs(userId, prefs) {
  if (!userId) return;
  writeLocal(PREFIX, userId, "prefs", normalizeMarketingPrefs(prefs));
}

export function mergeMarketingPrefs(user) {
  const fromUser = normalizeMarketingPrefs(user?.marketing_prefs);
  const local = readLocalMarketingPrefs(user?.id);
  // Local write wins if newer pattern: if local exists and differs, prefer local only when user.marketing_prefs empty
  const hasRemote = user?.marketing_prefs && Object.keys(user.marketing_prefs).length > 0;
  return hasRemote ? fromUser : normalizeMarketingPrefs({ ...fromUser, ...local });
}
