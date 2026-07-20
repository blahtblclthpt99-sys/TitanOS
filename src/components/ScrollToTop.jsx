import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const getHashId = (hash) => {
  const rawId = hash.slice(1);
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

/**
 * Scroll to top only on real route changes (PUSH / new path).
 * Ignore REPLACE on the same path — mobile tab re-taps were resetting Home scroll.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    if (navigationType === "POP") return;

    // Same path replace (e.g. tapping Home while already on Home) — keep scroll
    if (navigationType === "REPLACE" && prev === pathname && !hash) return;

    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => window.clearTimeout(timer);
    }

    // Only jump to top when the path actually changed
    if (prev === pathname) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}
