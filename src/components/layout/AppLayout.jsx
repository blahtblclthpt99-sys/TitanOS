import React, { useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import TabStack from "./TabStack";
import FloatingAIButton from "@/components/shared/FloatingAIButton";
import AppDownloadBanner from "@/components/shared/AppDownloadBanner";
import FeedbackButton from "@/components/shared/FeedbackButton";
import OfflineIndicator from "@/components/shared/OfflineIndicator";
import SessionExpiryBanner from "@/components/shared/SessionExpiryBanner";

export default function AppLayout() {
  const feedbackRef = useRef(null);

  useEffect(() => {
    const apply = (dark) => document.documentElement.classList.toggle("dark", dark);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const handler = (e) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <OfflineIndicator />
      <SessionExpiryBanner />
      <Sidebar />
      <MobileHeader />
      <MobileNav />

      <main
        className="md:ml-[var(--sidebar-width,72px)] transition-[margin] duration-300 ease-out"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 4.5rem)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          minHeight: "100svh",
        }}
      >
        <TabStack />
      </main>
      <FloatingAIButton onOpenFeedback={() => feedbackRef.current?.open?.()} />
      <FeedbackButton ref={feedbackRef} />
      <AppDownloadBanner />
    </div>
  );
}
