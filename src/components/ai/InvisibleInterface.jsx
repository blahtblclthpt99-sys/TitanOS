import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, CircleDot, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  buildInvisibleInterfacePrompt,
  sanitizeInvisibleInterface,
  validateInvisibleInterfaceForm,
} from "@/lib/invisibleInterface";

const STATUS_ICON = {
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: CircleAlert,
  info: CircleDot,
};

function buildInitialValues(fields) {
  return Object.fromEntries(
    fields.map((field) => [field.name, field.type === "boolean" ? Boolean(field.defaultValue) : field.defaultValue || ""])
  );
}

export default function InvisibleInterface({ spec, onNavigate, onPrompt }) {
  const ui = useMemo(() => sanitizeInvisibleInterface(spec), [spec]);
  const [values, setValues] = useState(() => buildInitialValues(ui?.fields || []));
  const [errors, setErrors] = useState({});

  if (!ui) return null;

  const updateValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const submitAction = (action) => {
    const nextErrors = validateInvisibleInterfaceForm(ui.fields, values);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const prompt = buildInvisibleInterfacePrompt(action, ui.fields, values);
    if (prompt) onPrompt?.(prompt);
  };

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

      {ui.type === "form" && ui.fields.length ? (
        <div className="space-y-3">
          {ui.fields.map((field) => (
            <div key={field.name}>
              {field.type === "boolean" ? (
                <label className="flex items-start gap-2.5 rounded-xl border border-border bg-background/40 p-3 cursor-pointer">
                  <Checkbox
                    checked={Boolean(values[field.name])}
                    onCheckedChange={(checked) => updateValue(field.name, checked === true)}
                    aria-describedby={field.help ? `${field.name}-help` : undefined}
                  />
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-foreground">
                      {field.label}{field.required ? " *" : ""}
                    </span>
                    {field.help ? (
                      <span id={`${field.name}-help`} className="block text-xs text-muted-foreground mt-0.5">
                        {field.help}
                      </span>
                    ) : null}
                  </span>
                </label>
              ) : (
                <label className="block">
                  <span className="text-xs font-semibold text-foreground">
                    {field.label}{field.required ? " *" : ""}
                  </span>
                  {field.type === "textarea" ? (
                    <textarea
                      value={values[field.name] || ""}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={values[field.name] || ""}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">{field.placeholder || "Choose an option"}</option>
                      {field.options.map((option) => (
                        <option key={`${field.name}-${option.value}`} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={field.type}
                      value={values[field.name] || ""}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      className="mt-1.5"
                    />
                  )}
                  {field.help ? <span className="block text-xs text-muted-foreground mt-1">{field.help}</span> : null}
                </label>
              )}
              {errors[field.name] ? <p className="text-xs text-destructive mt-1" role="alert">{errors[field.name]}</p> : null}
            </div>
          ))}
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
                if (action.kind === "submit_prompt") submitAction(action);
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
