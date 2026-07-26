/**
 * Light haptic feedback for primary ops (PTT, shift, delivery).
 * No-ops when reduce-motion is on or vibrate is unavailable.
 */
export function haptic(pattern = 12) {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  try {
    if (document.documentElement?.classList?.contains("reduce-motion")) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      try {
        if (localStorage.getItem("titanos-reduce-motion") !== "0") return;
      } catch {
        return;
      }
    }
    if (!navigator.vibrate) return;
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
