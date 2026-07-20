/**
 * TitanOS theme — light / dark / system + high-contrast + text scale + motion.
 */
import { systemPrefersContrast } from "@/lib/a11y";

const STORAGE_KEY = "titanos-theme";
const HC_KEY = "titanos-high-contrast";
const TEXT_KEY = "titanos-text-scale";
const MOTION_KEY = "titanos-reduce-motion";

export const TEXT_SCALES = [
  { id: "sm", label: "Small", pct: 90 },
  { id: "md", label: "Default", pct: 100 },
  { id: "lg", label: "Large", pct: 112 },
  { id: "xl", label: "Extra large", pct: 125 },
];

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "dark";
  } catch {
    return "dark";
  }
}

export function setStoredTheme(pref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function getHighContrast() {
  try {
    return localStorage.getItem(HC_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHighContrast(enabled) {
  try {
    localStorage.setItem(HC_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  applyHighContrast(enabled);
}

export function applyHighContrast(enabled = getHighContrast()) {
  // Manual toggle OR OS prefers-contrast: more
  const on = Boolean(enabled) || systemPrefersContrast();
  document.documentElement.classList.toggle("high-contrast", on);
  document.documentElement.dataset.highContrast = on ? "on" : "off";
  return on;
}

/** Listen for OS contrast preference changes (call once at boot) */
export function watchSystemContrast() {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  let mq;
  try {
    mq = window.matchMedia("(prefers-contrast: more)");
  } catch {
    return () => {};
  }
  const sync = () => applyHighContrast(getHighContrast());
  mq.addEventListener?.("change", sync);
  return () => mq.removeEventListener?.("change", sync);
}

export function getTextScale() {
  try {
    return localStorage.getItem(TEXT_KEY) || "md";
  } catch {
    return "md";
  }
}

export function setTextScale(scaleId) {
  const id = TEXT_SCALES.some((s) => s.id === scaleId) ? scaleId : "md";
  try {
    localStorage.setItem(TEXT_KEY, id);
  } catch {
    /* ignore */
  }
  applyTextScale(id);
  return id;
}

export function applyTextScale(scaleId = getTextScale()) {
  const meta = TEXT_SCALES.find((s) => s.id === scaleId) || TEXT_SCALES[1];
  document.documentElement.dataset.textScale = meta.id;
  document.documentElement.style.fontSize = `${meta.pct}%`;
  return meta.id;
}

export function getReduceMotionPref() {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function setReduceMotionPref(value) {
  try {
    if (value === null) localStorage.removeItem(MOTION_KEY);
    else localStorage.setItem(MOTION_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  applyReduceMotionPref(value);
}

export function applyReduceMotionPref(value = getReduceMotionPref()) {
  const system =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const on = value === null ? system : Boolean(value);
  document.documentElement.classList.toggle("reduce-motion", on);
  document.documentElement.dataset.reduceMotion = on ? "on" : "off";
  return on;
}

export function resolveDark(pref = getStoredTheme()) {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(pref = getStoredTheme()) {
  const dark = resolveDark(pref);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  applyHighContrast(getHighContrast());
  applyTextScale(getTextScale());
  applyReduceMotionPref(getReduceMotionPref());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#10141B" : "#EEF2F7");
  return dark;
}
