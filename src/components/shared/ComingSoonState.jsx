import React from "react";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Honest empty / unavailable state for features that are not production-ready.
 * Prefer this over fake users, fake stats, or interactive controls that do nothing.
 */
export default function ComingSoonState({
  title = "Coming soon",
  description,
  primaryTo,
  primaryLabel,
  className,
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center",
        className
      )}
      role="status"
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Clock className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {primaryTo && primaryLabel ? (
        <Button asChild className="mt-5 min-h-[44px]">
          <Link to={primaryTo}>{primaryLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
