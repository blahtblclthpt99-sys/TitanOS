import React, { useEffect, useMemo, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "react-router";
import { useAuth } from "@/lib/AuthContext";
import { normalizeAppPath } from "@/lib/routing";
import {
  ADSENSE_CLIENT,
  getAdPlacement,
  getAdSlot,
  shouldShowWebAd,
} from "@/lib/ads";

const SCRIPT_ID = "titan-adsense-script";

function ensureAdSenseScript(client) {
  if (typeof document === "undefined" || !client) return null;
  let script = document.getElementById(SCRIPT_ID);
  if (script) return script;

  script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.referrerPolicy = "strict-origin-when-cross-origin";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
  return script;
}

export default function AdPlacement() {
  const { user } = useAuth();
  const location = useLocation();
  const pathname = normalizeAppPath(location.pathname);
  const isNative = Capacitor.isNativePlatform();
  const placement = getAdPlacement(pathname);
  const slot = getAdSlot(placement);
  const renderedRef = useRef(false);

  const eligible = useMemo(
    () => shouldShowWebAd({ user, pathname, isNative }),
    [user, pathname, isNative]
  );

  useEffect(() => {
    renderedRef.current = false;
  }, [placement, slot]);

  useEffect(() => {
    if (!eligible || renderedRef.current || typeof window === "undefined") return undefined;

    const script = ensureAdSenseScript(ADSENSE_CLIENT);
    if (!script) return undefined;

    const renderAd = () => {
      if (renderedRef.current) return;
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        renderedRef.current = true;
      } catch {
        // Ad blockers, consent state, or provider failures must never break TitanOS.
      }
    };

    if (script.dataset.loaded === "true") {
      renderAd();
      return undefined;
    }

    const onLoad = () => {
      script.dataset.loaded = "true";
      renderAd();
    };
    script.addEventListener("load", onLoad, { once: true });
    return () => script.removeEventListener("load", onLoad);
  }, [eligible, placement, slot]);

  if (!eligible) return null;

  return (
    <section
      key={`${placement}-${slot}`}
      aria-label="Sponsored"
      className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8"
    >
      <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sponsored
        </p>
        <ins
          className="adsbygoogle block min-h-[90px] w-full overflow-hidden"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </section>
  );
}
