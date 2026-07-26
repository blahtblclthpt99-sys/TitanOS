import React from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlanCheckoutUrl } from "@/lib/plan";

/**
 * Soft paywall for premium add-ons (Driver Hub modules, Marketplace Apps, etc.).
 */
export default function PremiumGate({
  title = "Premium feature",
  description = "Upgrade to Worker Premium to unlock this add-on.",
  compact = false,
  children,
}) {
  const checkout = getPlanCheckoutUrl("worker_premium");

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-titan-amber/30 bg-titan-amber/5 p-4"
          : "titan-surface p-6 md:p-8 text-center space-y-4"
      }
    >
      <div className={compact ? "flex gap-3 items-start text-left" : "space-y-3"}>
        <div
          className={
            compact
              ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-titan-amber/15"
              : "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-titan-amber/15"
          }
        >
          <Lock className="h-5 w-5 text-titan-amber" aria-hidden />
        </div>
        <div className={compact ? "min-w-0 flex-1" : ""}>
          <p className="font-semibold text-foreground flex items-center gap-2 justify-center md:justify-start">
            {!compact && <Sparkles className="h-4 w-4 text-titan-cyan" aria-hidden />}
            {title}
          </p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
          {children}
          <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : "mt-5 justify-center"}`}>
            {checkout ? (
              <Button asChild className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold min-h-[44px]">
                <a href={checkout} target="_blank" rel="noopener noreferrer">
                  Upgrade · $29.99/mo
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/pricing">Compare plans</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
