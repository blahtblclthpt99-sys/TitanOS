import React, { useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { isRouteActive } from "@/lib/nav-utils";
import { useNavBadges } from "@/hooks/useNavBadges";
import NavBadge from "@/components/shared/NavBadge";
import { MOBILE_TAB_ITEMS, MORE_MENU_GROUPS } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";

const MORE_PATHS = MORE_MENU_GROUPS.flatMap((g) => g.paths).filter((p) => p !== "/more");

const TABS = [...MOBILE_TAB_ITEMS, { path: "/more", label: "More", icon: LayoutGrid }];

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const badges = useNavBadges();
  const pathname = normalizeAppPath(location.pathname);
  const touchStart = useRef(null);

  const moreActive = pathname === "/more" || MORE_PATHS.some((path) => isRouteActive(pathname, path));

  const activeIndex = TABS.findIndex((item) => {
    if (item.path === "/more") return moreActive;
    return isRouteActive(pathname, item.path);
  });

  const handleTab = (path) => {
    if (pathname === path) return;
    navigate(path);
  };

  const onTouchStart = (e) => {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || activeIndex < 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (Date.now() - start.t > 600) return;
    const next = dx < 0 ? activeIndex + 1 : activeIndex - 1;
    if (next < 0 || next >= TABS.length) return;
    handleTab(TABS[next].path);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 shadow-soft backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main navigation"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex h-[64px] items-stretch justify-around px-1">
        {MOBILE_TAB_ITEMS.map((item) => {
          const isActive = isRouteActive(pathname, item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleTab(item.path)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 transition-colors duration-fast select-none active:scale-[0.97] focus-ring ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-6 w-6 ${isActive ? "scale-105" : ""}`} aria-hidden="true" strokeWidth={isActive ? 2.25 : 2} />
              <NavBadge count={badges[item.path]} className="absolute right-1 top-1" />
              <span className="text-[10px] font-semibold leading-none" aria-hidden="true">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => handleTab("/more")}
          aria-label="More features"
          aria-current={moreActive ? "page" : undefined}
          className={`relative flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 transition-colors duration-fast select-none active:scale-[0.97] focus-ring ${
            moreActive ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <LayoutGrid className="h-6 w-6" aria-hidden="true" strokeWidth={moreActive ? 2.25 : 2} />
          <span className="text-[10px] font-semibold leading-none" aria-hidden="true">
            More
          </span>
          {moreActive && (
            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
          )}
        </button>
      </div>
    </nav>
  );
}
