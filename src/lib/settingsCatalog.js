/**
 * Settings catalog — categories, documented options, defaults, search, reset.
 * Source of truth for Settings UI + global search SETTINGS entries.
 */
import {
  User,
  Building2,
  Bell,
  Shield,
  Palette,
  Lock,
  Megaphone,
  BadgeCheck,
} from "lucide-react";
import {
  defaultMarketingPrefs,
  MARKETING_CHANNELS,
  MARKETING_CATEGORIES,
  MARKETING_FREQUENCIES,
  writeLocalMarketingPrefs,
} from "@/lib/marketingPrefs";
import {
  applyTheme,
  setStoredTheme,
  setHighContrast,
  setTextScale,
  setReduceMotionPref,
  TEXT_SCALES,
} from "@/lib/theme";

/** High-level categories shown on the Settings home. */
export const SETTINGS_CATEGORIES = Object.freeze([
  {
    id: "account",
    label: "Account",
    description: "Who you are and how you sign in",
  },
  {
    id: "business",
    label: "Business",
    description: "Company identity and professional presence",
  },
  {
    id: "communications",
    label: "Communications",
    description: "Alerts, marketing, and visibility",
  },
  {
    id: "safety",
    label: "Safety & privacy",
    description: "Trust, community sharing, and security",
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, contrast, text size, and motion",
  },
]);

/**
 * Panels / destinations. `category` maps to SETTINGS_CATEGORIES.
 * `resettable` = preference panel that supports Restore defaults.
 */
export const SETTINGS_PANELS = Object.freeze([
  {
    id: "profile",
    category: "account",
    icon: User,
    title: "Profile",
    description: "Name, email, phone, and location on your account",
    keywords: ["name", "email", "phone", "avatar", "username", "bio", "city"],
    docs: "Updates your TitanOS account profile. Email changes may require verification.",
    resettable: false,
  },
  {
    id: "accounts",
    category: "account",
    icon: Lock,
    title: "Connected accounts",
    description: "Google and email sign-in methods",
    keywords: ["google", "oauth", "login", "provider", "sign-in"],
    docs: "Shows which identity providers are linked. Unlinking is managed by your auth provider.",
    resettable: false,
  },
  {
    id: "security",
    category: "account",
    icon: Shield,
    title: "Security",
    description: "Password and login settings",
    keywords: ["password", "login", "security", "credentials"],
    docs: "Change your password. Minimum 8 characters. Does not log out other sessions automatically.",
    resettable: false,
  },
  {
    id: "pro-profile",
    category: "business",
    icon: BadgeCheck,
    title: "Professional profile",
    description: "Public bio, portfolio, skills, and badges",
    keywords: ["portfolio", "skills", "badges", "public", "hire"],
    docs: "Opens your professional profile page used for discovery and hiring.",
    href: "/profile",
    resettable: false,
  },
  {
    id: "company",
    category: "business",
    icon: Building2,
    title: "Company",
    description: "Business name, address, and branding",
    keywords: ["company", "logo", "address", "zip", "brand"],
    docs: "Business details used on invoices, estimates, and public booking pages.",
    resettable: false,
  },
  {
    id: "notifications",
    category: "communications",
    icon: Bell,
    title: "Notifications",
    description: "Job, message, review, account, and system alerts",
    keywords: ["alerts", "push", "inbox", "jobs", "messages"],
    docs: "Controls in-app notification categories. Device push for messages is requested separately.",
    resettable: true,
  },
  {
    id: "marketing",
    category: "communications",
    icon: Megaphone,
    title: "Marketing preferences",
    description: "Email, SMS, push, frequency, and topics",
    keywords: ["newsletter", "sms", "promotions", "unsubscribe", "digest"],
    docs: "Promotional communications only — separate from job and account alerts.",
    resettable: true,
  },
  {
    id: "privacy",
    category: "safety",
    icon: Lock,
    title: "Privacy",
    description: "Community visibility, AI guidance, and sharing",
    keywords: ["community", "visibility", "share", "city", "discover", "opportunity", "guidance", "jobs", "ai"],
    docs: "Controls community visibility and private account-level guidance preferences. Opportunity guidance never makes your job-search intent public.",
    resettable: true,
  },
  {
    id: "trust",
    category: "safety",
    icon: Shield,
    title: "Trust & Safety",
    description: "Report & block · identity verification in Labs",
    keywords: ["report", "block", "safety", "moderation", "verify"],
    docs: "Report users, manage blocks, and review trust tools.",
    href: "/trust-safety",
    resettable: false,
  },
  {
    id: "theme",
    category: "appearance",
    icon: Palette,
    title: "Appearance",
    description: "Theme, contrast, text size, and motion",
    keywords: ["dark", "light", "theme", "contrast", "font", "motion", "a11y"],
    docs: "Visual preferences stored on this device and synced when you save theme preference.",
    resettable: true,
  },
]);

export const NOTIFICATION_OPTIONS = Object.freeze([
  {
    key: "jobs",
    label: "Job updates",
    description: "Jobs, hires, estimates, and field activity",
    default: true,
    docs: "On by default so you do not miss schedule or hire changes.",
  },
  {
    key: "messages",
    label: "Messages",
    description: "New messages and replies",
    default: true,
    docs: "Inbox alerts inside TitanOS. Pair with device push if you leave the app.",
  },
  {
    key: "reviews",
    label: "Reviews",
    description: "Customer ratings and reputation",
    default: true,
    docs: "Reputation and review notifications.",
  },
  {
    key: "account",
    label: "Account alerts",
    description: "Payments, billing, security, and profile",
    default: true,
    docs: "Billing and security — keep on unless you have another monitor.",
  },
  {
    key: "system",
    label: "System updates",
    description: "Product news, maintenance, and tips",
    default: true,
    docs: "Product and maintenance notices. Turn off for a quieter inbox.",
  },
]);

export const PRIVACY_OPTIONS = Object.freeze([
  {
    key: "show_in_community",
    label: "Show my profile in Community",
    description: "Let other professionals discover you.",
    default: false,
    docs: "Off by default. Opt in only if you want to appear in Community discovery.",
  },
  {
    key: "show_city",
    label: "Show my city",
    description: "Display your city on your community profile.",
    default: false,
    docs: "Requires community visibility. City only — not street address.",
  },
  {
    key: "share_completed_jobs",
    label: "Share completed jobs",
    description: "Allow completed work to appear in Community.",
    default: false,
    docs: "Off by default. Does not share customer private details.",
  },
  {
    key: "opportunity_guidance",
    label: "Opportunity guidance",
    description: "Let Titan suggest matching work when your schedule is quiet.",
    default: false,
    docs: "Off by default. When enabled, 2nd Me may suggest opening Job Matches. This stays private, never applies to jobs, and does not authorize external-provider search.",
  },
  {
    key: "product_analytics",
    label: "Product analytics",
    description: "Anonymous usage events that help improve TitanOS (no emails or GPS).",
    default: true,
    docs: "Allowlisted events only. Opt out anytime. Does not include passwords or message contents.",
  },
  {
    key: "session_replay",
    label: "Session replay (masked)",
    description: "Privacy-masked session replay for crash diagnosis when enabled by ops.",
    default: false,
    docs: "Off by default. Text and inputs are masked. Also requires ops to enable replay (VITE_SENTRY_REPLAY).",
  },
]);

export const APPEARANCE_OPTIONS = Object.freeze([
  {
    key: "theme_pref",
    label: "Theme",
    description: "Light, dark, or match the device",
    default: "system",
    docs: "Default is System so TitanOS follows your OS appearance.",
  },
  {
    key: "high_contrast",
    label: "High contrast",
    description: "Stronger borders and text for visibility",
    default: false,
    docs: "Off by default. Useful outdoors or with low vision.",
  },
  {
    key: "text_scale",
    label: "Text size",
    description: "Scale UI text from small to extra large",
    default: "md",
    docs: "Default is medium (100%). Changes apply immediately on this device.",
  },
  {
    key: "reduce_motion",
    label: "Reduce motion",
    description: "System, reduce, or full motion",
    default: "system",
    docs: "Default follows the OS reduce-motion preference.",
  },
]);

export function defaultNotificationPrefs() {
  return Object.fromEntries(NOTIFICATION_OPTIONS.map((o) => [o.key, o.default]));
}

export function defaultPrivacyPrefs() {
  return {
    community_opt_in: false,
    privacy_prefs: Object.fromEntries(PRIVACY_OPTIONS.map((o) => [o.key, o.default])),
  };
}

export function defaultAppearancePrefs() {
  return {
    theme_pref: "system",
    high_contrast: false,
    text_scale: "md",
    reduce_motion: "system",
  };
}

/** Flat searchable option index (panels + toggles). */
export function listSettingsSearchDocs() {
  const docs = [];
  for (const panel of SETTINGS_PANELS) {
    docs.push({
      id: `settings-panel-${panel.id}`,
      panelId: panel.id,
      category: panel.category,
      label: panel.title,
      hint: panel.description,
      path: panel.href || `/settings?panel=${panel.id}`,
      keywords: [panel.title, panel.description, ...(panel.keywords || []), panel.docs].join(" "),
      kind: "panel",
    });
  }
  for (const o of NOTIFICATION_OPTIONS) {
    docs.push({
      id: `settings-notif-${o.key}`,
      panelId: "notifications",
      category: "communications",
      label: o.label,
      hint: o.description,
      path: "/settings?panel=notifications",
      keywords: `${o.label} ${o.description} ${o.docs} notification`,
      kind: "option",
      default: o.default,
      docs: o.docs,
    });
  }
  for (const o of PRIVACY_OPTIONS) {
    docs.push({
      id: `settings-privacy-${o.key}`,
      panelId: "privacy",
      category: "safety",
      label: o.label,
      hint: o.description,
      path: "/settings?panel=privacy",
      keywords: `${o.label} ${o.description} ${o.docs} privacy`,
      kind: "option",
      default: o.default,
      docs: o.docs,
    });
  }
  for (const o of APPEARANCE_OPTIONS) {
    docs.push({
      id: `settings-appear-${o.key}`,
      panelId: "theme",
      category: "appearance",
      label: o.label,
      hint: o.description,
      path: "/settings?panel=theme",
      keywords: `${o.label} ${o.description} ${o.docs} appearance`,
      kind: "option",
      default: o.default,
      docs: o.docs,
    });
  }
  for (const [key, label, description] of MARKETING_CHANNELS) {
    docs.push({
      id: `settings-mkt-${key}`,
      panelId: "marketing",
      category: "communications",
      label,
      hint: description,
      path: "/settings?panel=marketing",
      keywords: `${label} ${description} marketing`,
      kind: "option",
    });
  }
  for (const [key, label, description] of MARKETING_CATEGORIES) {
    docs.push({
      id: `settings-mktcat-${key}`,
      panelId: "marketing",
      category: "communications",
      label,
      hint: description,
      path: "/settings?panel=marketing",
      keywords: `${label} ${description} marketing topic`,
      kind: "option",
    });
  }
  for (const f of MARKETING_FREQUENCIES) {
    docs.push({
      id: `settings-mktfreq-${f.id}`,
      panelId: "marketing",
      category: "communications",
      label: f.label,
      hint: "Marketing frequency",
      path: "/settings?panel=marketing",
      keywords: `${f.label} frequency digest marketing`,
      kind: "option",
    });
  }
  for (const s of TEXT_SCALES) {
    docs.push({
      id: `settings-text-${s.id}`,
      panelId: "theme",
      category: "appearance",
      label: `Text size: ${s.label}`,
      hint: `${s.pct}% UI scale`,
      path: "/settings?panel=theme",
      keywords: `text size ${s.label} ${s.pct} font scale`,
      kind: "option",
    });
  }
  return docs;
}

export function searchSettings(query = "") {
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    return {
      panels: [...SETTINGS_PANELS],
      options: [],
      categories: SETTINGS_CATEGORIES,
    };
  }
  const panels = SETTINGS_PANELS.filter((p) => {
    const blob = `${p.title} ${p.description} ${(p.keywords || []).join(" ")} ${p.docs}`.toLowerCase();
    return blob.includes(q);
  });
  const options = listSettingsSearchDocs().filter(
    (d) => d.kind === "option" && `${d.label} ${d.hint} ${d.keywords}`.toLowerCase().includes(q)
  );
  const catIds = new Set([
    ...panels.map((p) => p.category),
    ...options.map((o) => o.category),
  ]);
  return {
    panels,
    options,
    categories: SETTINGS_CATEGORIES.filter((c) => catIds.has(c.id)),
  };
}

export function panelsByCategory(panels = SETTINGS_PANELS) {
  const map = {};
  for (const cat of SETTINGS_CATEGORIES) map[cat.id] = [];
  for (const p of panels) {
    if (!map[p.category]) map[p.category] = [];
    map[p.category].push(p);
  }
  return map;
}

/**
 * Apply preference defaults locally (+ optional remote save payload).
 * Does not wipe profile, company, password, or connected accounts.
 */
export function buildResetPayload(panelId) {
  if (panelId === "notifications") {
    return { notification_prefs: defaultNotificationPrefs() };
  }
  if (panelId === "privacy") {
    const p = defaultPrivacyPrefs();
    return { community_opt_in: p.community_opt_in, privacy_prefs: p.privacy_prefs };
  }
  if (panelId === "marketing") {
    return { marketing_prefs: defaultMarketingPrefs() };
  }
  if (panelId === "theme") {
    return { theme_pref: "system" };
  }
  return null;
}

/** Device-local appearance reset (immediate). */
export function resetAppearanceLocal() {
  setStoredTheme("system");
  applyTheme("system");
  setHighContrast(false);
  setTextScale("md");
  setReduceMotionPref(null); // system
  return defaultAppearancePrefs();
}

export function resetMarketingLocal(userId) {
  const prefs = defaultMarketingPrefs();
  writeLocalMarketingPrefs(userId, prefs);
  return prefs;
}
