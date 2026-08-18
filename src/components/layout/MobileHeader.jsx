import React from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { MOBILE_ROOT_PATHS, resolvePageTitle } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";
import NotificationBell from "@/components/shared/NotificationBell";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import ThemeToggle from "@/components/brand/ThemeToggle";

/** Return legacy/deep routes to the nearest surviving Titan pillar. */
function getPillarRoot(pathname) {
  if (pathname.startsWith("/hire")) return "/hire/matches";
  if (pathname.startsWith("/second-me") || pathname.startsWith("/assistant")) return "/second-me";
  if (pathname.startsWith("/autopilot") || pathname.startsWith("/leads") || pathname.startsWith("/follow-ups")) return "/autopilot";
  return "/";
}

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizeAppPath(location.pathname);
  const isRoot = MOBILE_ROOT_PATHS.includes(pathname);
  const title = resolvePageTitle(pathname);

  const handleBack = () => {
    const parent = getPillarRoot(pathname);
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
        <ThemeToggle className="shrink-0" />
        <NotificationBell />
      </div>
    </header>
  );
}
