import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useNavBadges } from "@/hooks/useNavBadges";
import { isRouteActive } from "@/lib/nav-utils";
import NavBadge from "@/components/shared/NavBadge";
import {
  APP_NAV_ITEMS,
  NAV_GROUP_META,
  NAV_GROUP_ORDER,
} from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";
import { readStorage, writeStorage } from "@/lib/storage";

const OPEN_GROUPS_KEY = "titanos_sidebar_open_groups";

function defaultOpenState(pathname) {
  const state = {};
  for (const id of NAV_GROUP_ORDER) {
    const meta = NAV_GROUP_META[id];
    state[id] = !meta.collapsible || meta.defaultOpen;
  }
  // Auto-open group containing the current route
  const activeItem = APP_NAV_ITEMS.find((item) => isRouteActive(pathname, item.path));
  if (activeItem?.group) state[activeItem.group] = true;
  return state;
}

function loadOpenState(pathname) {
  try {
    const raw = readStorage(OPEN_GROUPS_KEY);
    if (!raw) return defaultOpenState(pathname);
    const parsed = JSON.parse(raw);
    const base = defaultOpenState(pathname);
    return { ...base, ...parsed };
  } catch {
    return defaultOpenState(pathname);
  }
}

function NavLink({ item, expanded, active, badge }) {
  return (
    <Link
      to={item.path}
      title={!expanded ? item.label : undefined}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 relative min-h-[40px] ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeSidebarTab"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full"
          transition={{ duration: 0.2 }}
        />
      )}
      <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      {expanded && (
        <span className="text-sm whitespace-nowrap overflow-hidden flex-1 truncate">
          {item.label}
        </span>
      )}
      <NavBadge count={badge} className={expanded ? "" : "absolute -top-1 -right-1"} />
    </Link>
  );
}

export default function Sidebar() {
  const { expanded, toggle } = useSidebarState();
  const location = useLocation();
  const badges = useNavBadges();
  const pathname = normalizeAppPath(location.pathname);
  const [openGroups, setOpenGroups] = useState(() => loadOpenState(pathname));

  const grouped = useMemo(() => {
    const map = {};
    for (const item of APP_NAV_ITEMS) {
      const g = item.group || "daily";
      if (!map[g]) map[g] = [];
      map[g].push(item);
    }
    return NAV_GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({
      id: g,
      ...NAV_GROUP_META[g],
      items: map[g],
      badgeTotal: map[g].reduce((sum, item) => sum + (badges[item.path] || 0), 0),
      hasActive: map[g].some((item) => isRouteActive(pathname, item.path)),
    }));
  }, [badges, pathname]);

  // Keep the active route's group open
  useEffect(() => {
    const activeItem = APP_NAV_ITEMS.find((item) => isRouteActive(pathname, item.path));
    if (!activeItem?.group) return;
    setOpenGroups((prev) => {
      if (prev[activeItem.group]) return prev;
      const next = { ...prev, [activeItem.group]: true };
      writeStorage(OPEN_GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }, [pathname]);

  const toggleGroup = (id) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeStorage(OPEN_GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 260 : 72 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-40 shadow-soft"
      aria-label="Sidebar"
    >
      <div className="flex items-center h-16 px-3 border-b border-sidebar-border gap-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-titan-navy to-titan-electric flex items-center justify-center flex-shrink-0 shadow-soft">
          <Zap className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="ml-2 font-bold text-lg text-foreground whitespace-nowrap overflow-hidden flex-1"
            >
              TitanOS
            </motion.span>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={toggle}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          aria-keyshortcuts="Control+B Meta+B"
          title="Toggle sidebar (Ctrl+B)"
          className="ml-auto flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {grouped.map((group) => {
          const isOpen = !group.collapsible || openGroups[group.id] || group.hasActive;
          // Expanded: respect accordion. Collapsed rail: daily tools + active group only.
          const showItems = expanded
            ? isOpen
            : group.id === "daily" || group.hasActive;

          return (
            <div key={group.id} className="mb-1">
              {expanded && group.collapsible && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors min-h-[40px] ${
                    group.hasActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider flex-1">
                    {group.label}
                  </span>
                  {group.badgeTotal > 0 && (
                    <span className="text-[10px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-md">
                      {group.badgeTotal}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`}
                    aria-hidden="true"
                  />
                </button>
              )}

              {expanded && !group.collapsible && (
                <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}

              <AnimatePresence initial={false}>
                {showItems && (
                  <motion.div
                    initial={expanded ? { height: 0, opacity: 0 } : false}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-0.5 overflow-hidden"
                  >
                    {group.items.map((item) => (
                      <NavLink
                        key={item.path}
                        item={item}
                        expanded={expanded}
                        active={isRouteActive(pathname, item.path)}
                        badge={badges[item.path]}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </motion.aside>
  );
}
