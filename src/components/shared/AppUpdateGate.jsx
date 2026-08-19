import React, { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "titanos_update_later_version";
const TITAN_PUBLIC_ORIGIN = (import.meta.env.VITE_TITANOS_PUBLIC_ORIGIN || "https://titanfieldos.com").replace(/\/$/, "");

function compareVersions(a, b) {
  const left = String(a || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) - (right[i] || 0);
  }
  return 0;
}

export default function AppUpdateGate() {
  const [update, setUpdate] = useState(null);
  const current = import.meta.env.VITE_APP_VERSION || "0.0.0";

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const controller = new AbortController();
    fetch(`${TITAN_PUBLIC_ORIGIN}/api/functions/appVersion`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (!config || compareVersions(config.latest, current) <= 0) return;
        const required = compareVersions(config.minimum, current) > 0;
        if (!required && localStorage.getItem(DISMISS_KEY) === config.latest) return;
        setUpdate({ ...config, required });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [current]);

  if (!update) return null;
  const platform = Capacitor.getPlatform();
  const storeUrl = platform === "ios" ? update.ios_url : update.android_url;

  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 id="update-title" className="text-xl font-semibold text-foreground">
          Version {update.latest} is now available.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {update.required
            ? "This required update includes important reliability or security improvements."
            : "Update TitanOS for the latest improvements and fixes."}
        </p>
        <div className="mt-5 grid gap-3">
          <Button
            type="button"
            className="min-h-[48px]"
            disabled={!storeUrl}
            onClick={() => { window.location.href = storeUrl; }}
          >
            Update now
          </Button>
          {!update.required && (
            <Button
              type="button"
              variant="outline"
              className="min-h-[48px]"
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, update.latest);
                setUpdate(null);
              }}
            >
              Later
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
