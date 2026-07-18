import { useState, useEffect, useRef } from "react";

/**
 * usePullToRefresh — triggers onRefresh when the user pulls down past a threshold on mobile.
 * Returns { containerRef, isPulling, pullProgress (0–1), isRefreshing }.
 */
export function usePullToRefresh(onRefresh, { threshold = 72 } = {}) {
  const containerRef = useRef(null);
  const startYRef = useRef(null);
  const pullDistRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const [pullDist, setPullDist] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startYRef.current === null) return;
      const dist = Math.max(0, e.touches[0].clientY - startYRef.current);
      if (dist > 0 && el.scrollTop === 0) {
        const clamped = Math.min(dist, threshold * 1.5);
        pullDistRef.current = clamped;
        setPullDist(clamped);
      }
    };

    const onTouchEnd = async () => {
      const dist = pullDistRef.current;
      if (dist >= threshold && !isRefreshingRef.current) {
        setIsRefreshing(true);
        pullDistRef.current = 0;
        setPullDist(0);
        startYRef.current = null;
        try {
          await onRefreshRef.current();
        } finally {
          setIsRefreshing(false);
        }
      } else {
        pullDistRef.current = 0;
        setPullDist(0);
        startYRef.current = null;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [threshold]);

  return {
    containerRef,
    isPulling: pullDist > 0,
    pullProgress: Math.min(pullDist / threshold, 1),
    isRefreshing,
    pullDist,
  };
}
