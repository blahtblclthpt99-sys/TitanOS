import { useCallback, useEffect, useState } from "react";

/**
 * useSafeAsync — load data with loading/error/alive cleanup.
 * Use on thin CRUD pages to avoid unhandled rejections and setState-after-unmount.
 *
 * @template T
 * @param {() => Promise<T>} loader
 * @param {unknown[]} deps
 * @param {{ enabled?: boolean, initial?: T }} [opts]
 */
export function useSafeAsync(loader, deps = [], opts = {}) {
  const enabled = opts.enabled !== false;
  const [data, setData] = useState(opts.initial ?? null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // deps intentionally controlled by callers
  }, deps.concat([enabled]));

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await loader();
        if (alive) setData(result);
      } catch (err) {
        if (alive) setError(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // deps intentionally controlled by callers
  }, deps.concat([enabled]));

  return { data, setData, loading, error, reload };
}
