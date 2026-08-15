import React from "react";
import { ArrowRight, CheckCircle2, CircleAlert, CircleDot, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeInvisibleInterface } from "@/lib/invisibleInterface";

const STATUS_ICON = {
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: CircleAlert,
  info: CircleDot,
};

export default function InvisibleInterface({ spec, onNavigate, onPrompt }) {
  const ui = sanitizeInvisibleInterface(spec);
  if (!ui) return null;

  return (
    <section className="titan-surface border border-titan-cyan/20 rounded-2xl p-4 md:p-5 max-w-2xl w-full" aria-label={ui.title}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-titan-cyan">Invisible Interface</p>
          <h3 className="text-base font-bold text-foreground mt-1">{ui.title}</h3>
          {ui.subtitle ? <p className="text-xs text-muted-foreground mt-1">{ui.subtitle}</p> : null}
        </div>
        <span className="text-[10px] rounded-md bg-primary/10 text-primary px-2 py-1 whitespace-nowrap">
          {ui.provenance === "server_snapshot" ? "Your data" : "Guidance"}
        </span>
      </div>

      {ui.items.length ? (
        <div className={ui.type === "metrics" || ui.type === "comparison" ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}>
          {ui.items.map((item, index) => {
            const Icon = STATUS_ICON[item.status] || CircleDot;
            return (
              <div key={`${item.label}-${index}`} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-2.5">
                  <Icon className="w-4 h-4 mt-0.5 text-titan-cyan flex-shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      {item.value ? <p className="text-sm font-bold text-foreground">{item.value}</p> : null}
                    </div>
                    {item.detail ? <p className="text-xs text-muted-foreground mt-1">{item.detail}</p> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {ui.actions.length ? (
        <div className="flex flex-wrap gap-2 mt-4">
          {ui.actions.map((action, index) => (
            <Button
              key={`${action.kind}-${action.label}-${index}`}
              type="button"
              variant={index === 0 ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (action.kind === "navigate") onNavigate?.(action.path);
                if (action.kind === "prompt") onPrompt?.(action.prompt);
              }}
            >
              {action.label}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
