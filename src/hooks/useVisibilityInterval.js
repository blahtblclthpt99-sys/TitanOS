import { useEffect, useRef } from "react";

/**
 * setInterval that only runs while the document is visible.
 * Clears the timer when hidden (no background wakeups) — preferred over
 * "tick but no-op when hidden".
 *
 * @param {() => void} callback
 * @param {number} ms
 * @param {{ enabled?: boolean }} [opts]
 */
export function useVisibilityInterval(callback, ms, { enabled = true } = {}) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || !ms || ms < 0) return undefined;
    if (typeof document === "undefined") return undefined;

    let id = null;
    const clear = () => {
      if (id != null) {
        window.clearInterval(id);
        id = null;
      }
    };
    const start = () => {
      clear();
      if (document.visibilityState === "hidden") return;
      id = window.setInterval(() => cbRef.current?.(), ms);
    };

    start();
    const onVis = () => {
      if (document.visibilityState === "hidden") clear();
      else start();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clear();
    };
  }, [ms, enabled]);
}
