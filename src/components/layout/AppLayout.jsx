import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import DesktopTopBar from "./DesktopTopBar";
import MobileActionDock from "./MobileActionDock";
import TabStack from "./TabStack";
import FloatingAIButton from "@/components/shared/FloatingAIButton";
import TitanSupportButton from "@/components/shared/TitanSupportButton";
import AppDownloadBanner from "@/components/shared/AppDownloadBanner";
import FeedbackButton from "@/components/shared/FeedbackButton";
import OfflineIndicator from "@/components/shared/OfflineIndicator";
import SessionExpiryBanner from "@/components/shared/SessionExpiryBanner";
import AppUpdateGate from "@/components/shared/AppUpdateGate";
import SupportCenter from "@/pages/SupportCenter";
import SupportCommandCenter from "@/pages/SupportCommandCenter";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { normalizeAppPath } from "@/lib/routing";
import "@/styles/titan-reference.css";

export default function AppLayout() {
  const feedbackRef = useRef(null);
  const location = useLocation();
  const pathname = normalizeAppPath(location.pathname);
  const isSupportCenter = pathname === "/support";
  const isSupportCommandCenter = pathname === "/admin/support";

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
    <div className="titan-app-shell min-h-screen overflow-x-hidden bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="sr-only" aria-live="polite" id="a11y-status" />
      <OfflineIndicator />
      <SessionExpiryBanner />
      <AppUpdateGate />
      <div className="contents">
        <Sidebar />
        <DesktopTopBar />
        <MobileHeader />
        <nav aria-label="Mobile primary" className="lg:hidden contents">
          <MobileNav />
        </nav>
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Main content"
        className="titan-main-stage min-w-0 overflow-x-hidden lg:ml-[var(--sidebar-width,72px)] transition-[margin] duration-fast ease-out pt-[calc(env(safe-area-inset-top)+3.5rem)] lg:pt-14 outline-none pb-[calc(env(safe-area-inset-bottom)+10.5rem)] lg:pb-8"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          minHeight: "100svh",
        }}
      >
        <div className="page-enter min-w-0">
          {isSupportCenter ? <SupportCenter /> : isSupportCommandCenter ? <SupportCommandCenter /> : <TabStack />}
        </div>
      </main>

      <MobileActionDock onOpenFeedback={() => feedbackRef.current?.open?.()} />
      <TitanSupportButton />
      <div className="hidden lg:contents">
        <FloatingAIButton onOpenFeedback={() => feedbackRef.current?.open?.()} />
      </div>
      <FeedbackButton ref={feedbackRef} />
      <AppDownloadBanner />
    </div>
  );
}
