/**
 * Client-side performance helpers — light route hints only.
 * Avoid aggressive chunk prefetch on first paint (hurts Lighthouse unused-JS).
 */
const prefetched = new Set();

export function prefetchRoute(path) {
  if (typeof window === "undefined" || !path || prefetched.has(path)) return;
  prefetched.add(path);
  try {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = path;
    link.as = "document";
    document.head.appendChild(link);
  } catch {
    /* ignore */
  }
}

/** Warm a single lazy chunk after the user is clearly idle */
export function prefetchLazyChunks() {
  if (typeof window === "undefined") return;
  // Only warm the most common next step after marketing / home
  import("@/pages/Login").catch(() => {});
}

export function prefetchHotRoutes() {
  // Document hints only — do not download half the app after landing
  ["/login", "/register"].forEach((p) => prefetchRoute(p));
}

/** Idle callback wrapper — returns a cancel function when possible */
export function runWhenIdle(fn, timeout = 4000) {
  if (typeof window === "undefined") return () => {};
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(() => fn(), { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, Math.min(1200, timeout));
  return () => window.clearTimeout(id);
}

/** Schedule work after next paint — keeps LCP clean */
export function runAfterPaint(fn) {
  if (typeof window === "undefined") return () => {};
  let cancelled = false;
  const id = window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!cancelled) fn();
    });
  });
  return () => {
    cancelled = true;
    window.cancelAnimationFrame?.(id);
  };
}
