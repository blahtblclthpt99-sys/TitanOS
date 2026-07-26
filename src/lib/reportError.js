/**
 * Client-side error reporting — never silent for user-facing failures.
 * Logs to console; Sentry when configured.
 */
import { captureException } from "@/lib/sentry";

export function reportError(scope, error, extra) {
  const message = error?.message || String(error || "unknown");
  if (extra !== undefined) {
    console.error(`[${scope}]`, message, extra);
  } else {
    console.error(`[${scope}]`, message);
  }
  captureException(error instanceof Error ? error : new Error(message), {
    tags: { scope: String(scope) },
    extra: extra && typeof extra === "object" ? extra : undefined,
  });
  return message;
}

/** User-safe message — strips implementation leakage. */
export function publicErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const raw = String(error?.message || error || "").trim();
  if (!raw) return fallback;
  if (/supabase|postgrest|postgres|stripe|openai|stack|at\s+\w+\s+\(|ECONN|ENOTFOUND|internal/i.test(raw)) {
    return fallback;
  }
  if (raw.length > 180) return fallback;
  return raw;
}
