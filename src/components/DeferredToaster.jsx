import React, { Suspense, lazy, useEffect, useState } from "react";
import { runWhenIdle } from "@/lib/perf";

const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((m) => ({ default: m.Toaster }))
);

/**
 * Loads toast UI after first paint so marketing `/` stays free of Radix.
 * Toasts still work on auth/public pages once idle (or after 1.5s).
 */
export default function DeferredToaster() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return runWhenIdle(() => setReady(true), 1500);
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  );
}
