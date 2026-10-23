import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Helpful error state — clear problem + next step, not a dead end.
 */
export default function AppError({
  title = "Something went wrong",
  message = "This section couldn’t load. Check your connection and try again — your data is safe.",
  onRetry,
  onHome,
  error,
  fullScreen = false,
  className,
}) {
  const reduceMotion = useReducedMotion();
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status || error?.statusCode || 0);
  // Do not expose raw backend error messages, which can include sensitive data.
  const diagnostic =
    status === 401 || code === "PGRST301"
      ? "Your session may have expired. Check your sign-in before retrying."
      : status === 403 || code === "42501"
        ? "Access was denied. Account permissions may need attention."
        : status === 404 || code === "42P01" || code === "PGRST205"
          ? "A required service or data resource is unavailable. An update or backend repair may be needed."
          : status >= 500 || code === "NETWORK_ERROR" || code === "TIMEOUT"
            ? "The service is temporarily unavailable. Check your connection and try again."
            : error
              ? "The requested information could not be loaded. Retry or contact support if this continues."
              : message;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center",
        fullScreen ? "min-h-screen bg-background" : "min-h-[50vh]",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-soft ring-1 ring-destructive/20"
        aria-hidden="true"
      >
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="mb-2 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">{diagnostic}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <Button type="button" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        ) : null}
        {onHome ? (
          <Button type="button" variant="outline" onClick={onHome} className="gap-2">
            <Home className="h-4 w-4" aria-hidden="true" />
            Go home
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}
