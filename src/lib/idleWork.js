/**
 * Schedules non-critical authenticated-shell work after the first paint.
 *
 * `delay` prevents startup work from immediately competing with route hydration,
 * while requestIdleCallback lets capable browsers run sooner when the main thread
 * is already quiet. The timeout guarantees the work is not starved indefinitely.
 * Returns a cancellation function suitable for React effects.
 */
export function scheduleIdleWork(callback, { delay = 0, timeout = 2000 } = {}) {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {};
  }

  let cancelled = false;
  let delayId = null;
  let idleId = null;
  let fallbackId = null;

  const invoke = () => {
    if (cancelled) return;
    callback();
  };

  const schedule = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(invoke, { timeout });
      return;
    }
    fallbackId = window.setTimeout(invoke, 0);
  };

  delayId = window.setTimeout(schedule, Math.max(0, Number(delay) || 0));

  return () => {
    cancelled = true;
    if (delayId !== null) window.clearTimeout(delayId);
    if (fallbackId !== null) window.clearTimeout(fallbackId);
    if (idleId !== null && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleId);
    }
  };
}
