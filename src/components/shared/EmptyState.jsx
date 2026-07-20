import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Meaningful empty state — calm, actionable, motion-aware.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  onAction,
  actionLabel,
  secondaryAction,
  secondaryLabel,
  className,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center px-4 py-16 text-center md:py-20",
        className
      )}
      role="status"
    >
      <div className="relative mb-5">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-soft ring-1 ring-primary/15"
          aria-hidden="true"
        >
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <span
          className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-primary/40 success-pop"
          aria-hidden="true"
        />
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {(onAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onAction && actionLabel ? (
            <Button type="button" onClick={onAction} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {actionLabel}
            </Button>
          ) : null}
          {secondaryAction && secondaryLabel ? (
            <Button type="button" variant="outline" onClick={secondaryAction}>
              {secondaryLabel}
            </Button>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
