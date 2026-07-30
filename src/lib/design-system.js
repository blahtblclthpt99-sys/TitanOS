/**
 * TitanOS Design System — single source of truth for tokens & control recipes.
 * Prefer these names in new UI; map legacy titan-cyan → primary.
 * Deprecated: `glass` / `glass-hover` — use SURFACE / SURFACE_INTERACTIVE.
 *
 * Typography: text-display | text-title | text-heading | text-body | text-caption
 * Surfaces:   titan-surface | titan-surface-interactive | Card
 * Elevation:  shadow-soft | shadow-lift
 * Focus:      focus-ring
 * Motion:     duration-fast | duration-base | duration-slow + ease-out
 */

/** Semantic status → Badge / StatusBadge variants */
export const STATUS_TONES = {
  // Jobs
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "destructive",
  // Invoices
  draft: "muted",
  sent: "info",
  viewed: "info",
  paid: "success",
  partial: "warning",
  overdue: "destructive",
  // Customers
  lead: "warning",
  active: "success",
  inactive: "muted",
  vip: "info",
  // Estimates / hire
  accepted: "success",
  declined: "destructive",
  expired: "muted",
  open: "info",
  hired: "success",
  held: "warning",
  refunded: "muted",
};

/** Lucide / SVG icon box sizes (px via Tailwind) */
export const ICON_SIZE = {
  sm: "h-4 w-4", // 16
  md: "h-5 w-5", // 20
  lg: "h-6 w-6", // 24
  xl: "h-8 w-8", // 32
};

/** Control heights — keep inputs, selects, and buttons aligned.
 *  Prefer `md` (≥44px) for interactive controls. `sm` is dense-only (desktop tables). */
export const CONTROL = {
  sm: "h-9 min-h-[36px]",
  md: "h-11 min-h-[44px]",
  lg: "h-12 min-h-[48px]",
};

/** Shared field chrome (Input, Textarea, SelectTrigger, native select) */
export const FIELD_CLASS =
  "rounded-md border border-border bg-muted text-foreground shadow-sm transition-colors duration-fast " +
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50";

/** Surface / card — prefer over legacy `glass` */
export const SURFACE = "titan-surface";
export const SURFACE_INTERACTIVE = "titan-surface titan-surface-interactive";

/** Card body padding — match CardHeader / CardContent */
export const CARD_PAD = "p-4 md:p-5";

export const RADIUS = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

export const ELEVATION = {
  soft: "shadow-soft",
  lift: "shadow-lift",
};

export const MOTION = {
  fast: "duration-fast",
  base: "duration-base",
  slow: "duration-slow",
};

export const TYPE = {
  display: "text-display font-display text-[var(--titan-heading)]",
  title: "text-title font-heading text-[var(--titan-heading)]",
  heading: "text-heading font-heading text-[var(--titan-heading)]",
  body: "text-body text-foreground",
  caption: "text-caption text-muted-foreground",
  eyebrow: "text-caption font-bold uppercase tracking-wider text-primary",
};

/** Overlay content chrome (menus / popovers) — match Dialog elevation */
export const OVERLAY_CONTENT =
  "rounded-md border border-border bg-popover text-popover-foreground shadow-lift duration-fast";

/** Design system version — bump when breaking token changes ship */
export const DS_VERSION = "3.1.0";
