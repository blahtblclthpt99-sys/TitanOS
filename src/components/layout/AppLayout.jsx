import React, { useEffect } from "react";
import { useLocation } from "react-router";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import DesktopTopBar from "./DesktopTopBar";
import TabStack from "./TabStack";
import FloatingAIButton from "@/components/shared/FloatingAIButton";
import OfflineIndicator from "@/components/shared/OfflineIndicator";
import SessionExpiryBanner from "@/components/shared/SessionExpiryBanner";
import AppUpdateGate from "@/components/shared/AppUpdateGate";
import AdPlacement from "@/components/monetization/AdPlacement";
import SupportCenter from "@/pages/SupportCenter";
import SupportCommandCenter from "@/pages/SupportCommandCenter";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { normalizeAppPath } from "@/lib/routing";
import "@/styles/titan-reference.css";

export default function AppLayout() {
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
    <div className="titan-app-shell min-h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="sr-only" aria-live="polite" id="a11y-status" />
      <OfflineIndicator />
      <SessionExpiryBanner />
      <AppUpdateGate />

      <Sidebar />
      <DesktopTopBar />
      <MobileHeader />
      <nav aria-label="Mobile primary" className="md:hidden contents">
        <MobileNav />
      </nav>

      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Main content"
        className="titan-main-stage md:ml-[var(--sidebar-width,72px)] transition-[margin] duration-fast ease-out pt-[calc(env(safe-area-inset-top)+3.5rem)] md:pt-14 outline-none pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          minHeight: "100svh",
        }}
      >
        <div className="page-enter">
          {isSupportCenter ? <SupportCenter /> : isSupportCommandCenter ? <SupportCommandCenter /> : <TabStack />}
        </div>
        {!isSupportCenter && !isSupportCommandCenter ? <AdPlacement key={pathname} /> : null}
      </main>

      <FloatingAIButton />
    </div>
  );
}
