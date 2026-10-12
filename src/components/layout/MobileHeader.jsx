import React from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Search } from "lucide-react";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import ThemeToggle from "@/components/brand/ThemeToggle";
import { MOBILE_ROOT_PATHS, resolvePageTitle } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizeAppPath(location.pathname);
  const isRoot = MOBILE_ROOT_PATHS.includes(pathname);
  const pageTitle = resolvePageTitle(pathname);
  function back() {
    if (typeof window !== "undefined" && window.history.state?.idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  }
  return <header className="md:hidden fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl flex items-center px-3"
    style={{paddingTop:"env(safe-area-inset-top)",height:"calc(env(safe-area-inset-top) + 3.5rem)"}}>
    <div className="flex h-14 w-full items-center gap-2">
      {isRoot
        ? <TitanBrandLogo to="/" className="flex-1 min-w-0" markClassName="h-8 w-8"/>
        : <div className="flex-1 min-w-0 flex items-center gap-1">
            <button type="button" aria-label="Go back" onClick={back} className="min-h-11 min-w-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5"/></button>
            <h1 className="font-semibold text-sm truncate">{pageTitle}</h1>
          </div>}
      <Link to="/hire" aria-label="Search jobs" className="min-h-11 min-w-11 rounded-lg flex items-center justify-center hover:bg-muted text-primary"><Search className="w-5 h-5"/></Link>
      <ThemeToggle className="shrink-0"/>
    </div>
  </header>;
}
