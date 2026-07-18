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
    <div className="fixed bottom-[4.5rem] md:bottom-0 left-0 right-0 z-40 px-3 pb-1 md:pb-3 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <div className="glass border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white leading-tight">TitanOS for Android</p>
            <p className="text-[11px] text-white/40 leading-tight">
              Install from Google Play ·{" "}
              <a href={TITANOS_PLAY_TESTING_URL} className="text-titan-cyan/80 underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                tester opt-in
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={openPlayStore}
            className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-xl bg-titan-cyan hover:bg-titan-cyan/90 text-black text-[11px] font-semibold transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Get on Play
          </button>
          <button onClick={dismiss} className="text-white/20 hover:text-white/60 transition-colors p-1 flex-shrink-0" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
