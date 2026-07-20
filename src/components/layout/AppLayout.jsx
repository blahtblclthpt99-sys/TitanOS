import React, { useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import DesktopTopBar from "./DesktopTopBar";
import QuickCreateFAB from "./QuickCreateFAB";
import TabStack from "./TabStack";
import FloatingAIButton from "@/components/shared/FloatingAIButton";
import FloatingVoiceButton from "@/components/shared/FloatingVoiceButton";
import AppDownloadBanner from "@/components/shared/AppDownloadBanner";
import FeedbackButton from "@/components/shared/FeedbackButton";
import OfflineIndicator from "@/components/shared/OfflineIndicator";
import SessionExpiryBanner from "@/components/shared/SessionExpiryBanner";
import { applyTheme, getStoredTheme } from "@/lib/theme";

export default function AppLayout() {
  const feedbackRef = useRef(null);

  useEffect(() => {
    const pref = getStoredTheme();
    applyTheme(pref);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="sr-only" aria-live="polite" id="a11y-status" />
      <OfflineIndicator />
      <SessionExpiryBanner />
      <div className="contents">
        <Sidebar />
        <DesktopTopBar />
        <MobileHeader />
        <nav aria-label="Mobile primary" className="md:hidden contents">
          <MobileNav />
        </nav>
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Main content"
        className="md:ml-[var(--sidebar-width,72px)] transition-[margin] duration-fast ease-out pt-[calc(env(safe-area-inset-top)+3.5rem)] md:pt-14 outline-none"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 4.5rem)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          minHeight: "100svh",
        }}
      >
        <div className="page-enter">
          <TabStack />
        </div>
      </main>
      <QuickCreateFAB />
      <FloatingVoiceButton />
      <FloatingAIButton onOpenFeedback={() => feedbackRef.current?.open?.()} />
      <FeedbackButton ref={feedbackRef} hideTrigger />
      <AppDownloadBanner />
    </div>
  );
}
