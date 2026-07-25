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

/**
 * Visible fail-closed banner when production is missing Supabase env.
 * Prevents a silent "auth broken" launch.
 */
export default function ConfigMissingBanner() {
  if (!missing) return null;
  if (!import.meta.env.PROD) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] border-b border-destructive/40 bg-destructive text-destructive-foreground px-4 py-2.5 text-center text-sm font-semibold shadow-lift"
    >
      <span className="inline-flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        TitanOS is misconfigured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before launch.
      </span>
    </div>
  );
}
