import React from "react";
import { useReducedMotion, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page title block — purpose in ≤5 seconds via eyebrow + title + one-line subtitle.
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  onAdd,
  addLabel = "Add New",
  actions,
  className,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex items-start justify-between gap-4 mb-6", className)}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-caption font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-title text-foreground tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        {onAdd && (
          <Button onClick={onAdd} className="gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" /> {addLabel}
          </Button>
        )}
      </div>
    </motion.header>
  );
}
