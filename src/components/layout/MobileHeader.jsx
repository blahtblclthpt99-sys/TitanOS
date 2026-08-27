import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, Search } from "lucide-react";
import { MOBILE_ROOT_PATHS, resolvePageTitle } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";
import NotificationBell from "@/components/shared/NotificationBell";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import ThemeToggle from "@/components/brand/ThemeToggle";
import MobileGlobalSearch from "@/components/layout/MobileGlobalSearch";

/**
 * Map nested routes to a sensible parent when browser history is empty
 * or the entry was a cold deep link (location.key === "default").
 */
function getTabRoot(pathname) {
  if (pathname.startsWith("/driver")) return "/driver";
  if (pathname.startsWith("/customers")) return "/customers";
  if (pathname.startsWith("/invoices")) return "/invoices";
  if (pathname.startsWith("/work/jobs")) return "/work/jobs";
  if (pathname.startsWith("/jobs")) return "/jobs";
  if (pathname.startsWith("/estimates")) return "/estimates";
  if (pathname.startsWith("/marketplace")) return "/marketplace";
  if (pathname.startsWith("/messages")) return "/messages";
  if (pathname.startsWith("/community")) return "/community";
  if (pathname.startsWith("/assistant")) return "/assistant";
  if (pathname.startsWith("/settings") || pathname.startsWith("/trust-safety")) return "/more";
  if (pathname.startsWith("/profile") || pathname.startsWith("/titan-score")) return "/profile";
  if (pathname.startsWith("/schedule")) return "/more";
  if (pathname.startsWith("/finances") || pathname.startsWith("/payments")) return "/more";
  if (pathname.startsWith("/fleet") || pathname.startsWith("/hire")) return "/more";
  if (pathname.startsWith("/admin")) return "/more";
  if (pathname.startsWith("/comms")) return "/comms";
  if (pathname.startsWith("/escrow") || pathname.startsWith("/deals") || pathname.startsWith("/emergency") || pathname.startsWith("/phone") || pathname.startsWith("/insurance") || pathname.startsWith("/design-system") || pathname.startsWith("/growth-coach")) {
    return "/more";
  }
  return "/more";
}

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = normalizeAppPath(location.pathname);
  const isRoot = MOBILE_ROOT_PATHS.includes(pathname);
  const title = resolvePageTitle(pathname);

  const handleBack = () => {
    const parent = getTabRoot(pathname);
    const isColdEntry = !location.key || location.key === "default";
    const canGoBack =
      !isColdEntry &&
      typeof window !== "undefined" &&
      window.history.state?.idx > 0;

    if (canGoBack) {
      navigate(-1);
      return;
    }
    navigate(parent, { replace: true });
  };

  return (
    <>
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border flex items-center px-4"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          height: "calc(env(safe-area-inset-top) + 3.5rem)",
        }}
      >
        <div className="flex items-center h-14 w-full gap-2">
          {isRoot ? (
            <TitanBrandLogo to="/" className="flex-1 min-w-0" markClassName="h-8 w-8" />
          ) : (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <button
                type="button"
                onClick={handleBack}
                aria-label={`Back from ${title}`}
                className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] -ml-1 shrink-0 focus-ring rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <h1 className="text-sm font-semibold text-foreground truncate pr-1">{title}</h1>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-ring"
            aria-label="Search TitanOS"
          >
            <Search className="w-5 h-5" aria-hidden />
          </button>
          <ThemeToggle className="shrink-0" />
          <NotificationBell />
        </div>
      </header>
      <MobileGlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
