import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MOBILE_ROOT_PATHS } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";
import NotificationBell from "@/components/shared/NotificationBell";

function getTabRoot(pathname) {
  if (pathname.startsWith("/customers/")) return "/customers";
  if (pathname.startsWith("/invoices/")) return "/invoices";
  if (pathname.startsWith("/jobs/")) return "/jobs";
  return "/";
}

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizeAppPath(location.pathname);
  const isRoot = MOBILE_ROOT_PATHS.includes(pathname);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(getTabRoot(pathname), { replace: true });
    }
  };

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-white/5 flex items-center px-4"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        height: "calc(env(safe-area-inset-top) + 3.5rem)",
      }}
    >
      <div className="flex items-center h-14 w-full gap-2">
        {isRoot ? (
          <span className="gradient-text font-bold text-lg tracking-tight flex-1">TitanOS</span>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors min-h-[44px] min-w-[44px] -ml-1 flex-1"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}
        <NotificationBell />
      </div>
    </header>
  );
}
