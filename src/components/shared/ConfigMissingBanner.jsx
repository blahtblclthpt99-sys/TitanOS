import React from "react";
import { AlertTriangle } from "lucide-react";

const missing =
  typeof import.meta !== "undefined" &&
  (!(
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL
  ) ||
    !(
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ));

function isIsolatedWorkersPreview() {
  if (typeof window === "undefined") return false;
  const host = String(window.location?.hostname || "").toLowerCase();
  return host.endsWith(".workers.dev");
}

/**
 * Visible fail-closed banner when a production-facing TitanOS origin is missing Supabase env.
 * Isolated workers.dev migration previews deliberately omit live credentials and keep
 * authenticated/data APIs fail-closed, so they do not present a production misconfiguration banner.
 */
export default function ConfigMissingBanner() {
  if (!missing) return null;
  if (!import.meta.env.PROD) return null;
  if (isIsolatedWorkersPreview()) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] border-b border-destructive/40 bg-destructive text-destructive-foreground px-4 py-2.5 text-center text-sm font-semibold shadow-lift"
    >
      <span className="inline-flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        TitanOS is misconfigured — configure the Supabase URL and publishable key before production launch.
      </span>
    </div>
  );
}
