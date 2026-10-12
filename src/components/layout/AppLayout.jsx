import React from "react";
import { Link, useLocation } from "react-router";
import { BriefcaseBusiness, FileText, Search } from "lucide-react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import TabStack from "./TabStack";
import TitanSupportButton from "@/components/shared/TitanSupportButton";
import OfflineIndicator from "@/components/shared/OfflineIndicator";
import SessionExpiryBanner from "@/components/shared/SessionExpiryBanner";
import AppUpdateGate from "@/components/shared/AppUpdateGate";
import SupportCenter from "@/pages/SupportCenter";
import { normalizeAppPath } from "@/lib/routing";
import "@/styles/titan-reference.css";

/** One focused workspace for job seekers. Business and advertising tools are not mounted. */
export default function AppLayout() {
  const pathname = normalizeAppPath(useLocation().pathname);
  return <div className="titan-app-shell min-h-screen bg-background text-foreground">
    <a href="#main-content" className="skip-link">Skip to career tools</a>
    <OfflineIndicator />
    <SessionExpiryBanner />
    <AppUpdateGate />
    <Sidebar />
    <MobileHeader />
    <header className="hidden md:flex fixed z-30 top-0 right-0 left-[var(--sidebar-width,72px)] h-14 items-center justify-between gap-3 px-6 border-b border-border bg-card/95 backdrop-blur-md" aria-label="Career navigation">
      <Link to="/" className="flex gap-2 items-center text-sm font-bold"><BriefcaseBusiness className="w-5 h-5 text-primary"/> TitanOS Careers</Link>
      <nav className="flex gap-2">
        <Link to="/hire" className="min-h-10 px-3 flex gap-1.5 items-center rounded-lg text-sm hover:bg-muted"><Search className="h-4 w-4"/> Find jobs</Link>
        <Link to="/resume" className="min-h-10 px-3 flex gap-1.5 items-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold"><FileText className="h-4 w-4"/> My résumé</Link>
      </nav>
    </header>
    <main id="main-content" tabIndex={-1} aria-label="Career workspace"
      className="titan-main-stage md:ml-[var(--sidebar-width,72px)] pt-[calc(env(safe-area-inset-top)+3.5rem)] md:pt-14 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8 min-h-[100svh] outline-none"
      style={{paddingLeft:"env(safe-area-inset-left)",paddingRight:"env(safe-area-inset-right)"}}>
      {pathname === "/support" ? <SupportCenter /> : <TabStack />}
    </main>
    <MobileNav />
    <TitanSupportButton />
  </div>;
}
