import React, { useState } from "react";
import { Smartphone, X, ExternalLink } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { openPlayStore, TITANOS_PLAY_TESTING_URL } from "@/lib/app-download";

/**
 * Android install banner — Play Store first (testers), dismissible per session.
 * Hidden inside the native Capacitor app.
 */
export default function AppDownloadBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("titanos_app_banner_dismissed") === "1"
  );

  if (Capacitor.isNativePlatform()) return null;
  if (dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem("titanos_app_banner_dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+11.5rem)] md:bottom-3 left-0 right-0 z-30 px-3 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <div className="rounded-2xl border border-border bg-card/95 px-4 py-3 flex items-center gap-3 shadow-lift backdrop-blur-xl">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-titan-orbit flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground leading-tight">TitanOS for Android</p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Install from Google Play ·{" "}
              <a href={TITANOS_PLAY_TESTING_URL} className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                tester opt-in
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={openPlayStore}
            className="flex items-center gap-1.5 flex-shrink-0 min-h-[44px] px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-semibold transition-colors focus-ring"
          >
            <ExternalLink className="w-3 h-3" />
            Get on Play
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors inline-flex min-h-[44px] min-w-[44px] items-center justify-center flex-shrink-0 rounded-md focus-ring"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
