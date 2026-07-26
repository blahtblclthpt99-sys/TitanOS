import React, { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  THEME_OPTIONS,
  getStoredTheme,
  persistAndApplyTheme,
  normalizeThemePref,
} from "@/lib/theme";

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const LABELS = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/**
 * Compact theme control — cycles system → light → dark, or renders a 3-way segmented control.
 */
export default function ThemeToggle({ variant = "cycle", className = "", onChange }) {
  const [pref, setPref] = useState(() => getStoredTheme());

  useEffect(() => {
    const sync = () => setPref(getStoredTheme());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const apply = (next) => {
    const value = normalizeThemePref(next);
    persistAndApplyTheme(value);
    setPref(value);
    onChange?.(value);
  };

  const cycle = () => {
    const i = THEME_OPTIONS.indexOf(pref);
    apply(THEME_OPTIONS[(i + 1) % THEME_OPTIONS.length]);
  };

  if (variant === "segmented") {
    return (
      <div
        className={`grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/60 p-1 ${className}`}
        role="group"
        aria-label="Color theme"
      >
        {THEME_OPTIONS.map((option) => {
          const Icon = ICONS[option];
          const active = pref === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => apply(option)}
              aria-pressed={active}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors focus-ring ${
                active
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {LABELS[option]}
            </button>
          );
        })}
      </div>
    );
  }

  const Icon = ICONS[pref] || Monitor;
  return (
    <button
      type="button"
      onClick={cycle}
      className={`inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border bg-muted text-foreground hover:bg-secondary focus-ring ${className}`}
      aria-label={`Theme: ${LABELS[pref]}. Click to change.`}
      title={`Theme: ${LABELS[pref]}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
