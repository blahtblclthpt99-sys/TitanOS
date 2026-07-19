/**
 * Apply light / dark / system theme to <html>.
 * Persists via localStorage key `titanos-theme`.
 */
const STORAGE_KEY = "titanos-theme";

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "system";
  } catch {
    return "system";
  }
}

export function setStoredTheme(pref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#12151C" : "#F7F9FC");
  return dark;
}
