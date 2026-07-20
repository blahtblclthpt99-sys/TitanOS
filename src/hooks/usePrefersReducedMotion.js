/**
 * Respects both OS prefers-reduced-motion and TitanOS Settings override.
 * Prefer this over framer-motion's useReducedMotion alone.
 */
import { useEffect, useState } from "react";
import { getReduceMotionPref } from "@/lib/theme";

function computeReduced() {
  if (typeof window === "undefined") return false;
  const pref = getReduceMotionPref();
  if (pref === true) return true;
  if (pref === false) return false;
  if (document.documentElement.classList.contains("reduce-motion")) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(computeReduced);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(computeReduced());
    mq.addEventListener?.("change", sync);
    window.addEventListener("storage", sync);
    // Observe class changes from Settings
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-reduce-motion"] });
    sync();
    return () => {
      mq.removeEventListener?.("change", sync);
      window.removeEventListener("storage", sync);
      obs.disconnect();
    };
  }, []);

  return reduced;
}
