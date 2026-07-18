import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { isRouteActive } from "@/lib/nav-utils";
import { useNavBadges } from "@/hooks/useNavBadges";
import NavBadge from "@/components/shared/NavBadge";
import { MOBILE_TAB_ITEMS, MORE_MENU_GROUPS } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";

const MORE_PATHS = MORE_MENU_GROUPS.flatMap((g) => g.paths);

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const badges = useNavBadges();
  const pathname = normalizeAppPath(location.pathname);
  const moreActive = pathname === "/more" || MORE_PATHS.some((path) => isRouteActive(pathname, path));

  const handleTab = (path) => {
    if (pathname === path) {
      navigate(path, { replace: true });
    } else {
      navigate(path);
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16 px-1" role="tablist">
        {MOBILE_TAB_ITEMS.map((item) => {
          const isActive = isRouteActive(pathname, item.path);
          return (
            <button
              key={item.path}
              type="button"
              role="tab"
              onClick={() => handleTab(item.path)}
              aria-label={item.label}
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 select-none min-w-[56px] min-h-[44px] justify-center ${
                isActive ? "text-titan-cyan" : "text-white/40"
              }`}
            >
              <item.icon className="w-5 h-5" aria-hidden="true" />
              <NavBadge count={badges[item.path]} className="absolute top-0 right-0.5" />
              <span className="text-[10px] font-medium" aria-hidden="true">
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          role="tab"
          onClick={() => handleTab("/more")}
          aria-label="More features"
          aria-selected={moreActive}
          aria-current={moreActive ? "page" : undefined}
          className={`relative flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 select-none min-w-[56px] min-h-[44px] justify-center ${
            moreActive ? "text-titan-cyan" : "text-white/40"
          }`}
        >
          <LayoutGrid className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium" aria-hidden="true">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
