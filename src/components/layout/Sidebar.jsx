import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Zap } from "lucide-react";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useNavBadges } from "@/hooks/useNavBadges";
import { isRouteActive } from "@/lib/nav-utils";
import NavBadge from "@/components/shared/NavBadge";
import {
  APP_NAV_ITEMS,
  NAV_GROUP_META,
  NAV_GROUP_ORDER,
  filterNavItems,
} from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";
import { readStorage, writeStorage } from "@/lib/storage";
import { useAuth } from "@/lib/AuthContext";

const OPEN_GROUPS_KEY = "titanos_sidebar_open_groups";

function defaultOpenState(pathname) {
  const state = {};
  for (const id of NAV_GROUP_ORDER) {
    const meta = NAV_GROUP_META[id];
    state[id] = !meta.collapsible || meta.defaultOpen;
  }
  const activeItem = APP_NAV_ITEMS.find((item) => isRouteActive(pathname, item.path));
  if (activeItem?.group) state[activeItem.group] = true;
  return state;
}

function loadOpenState(pathname) {
  try {
    const raw = readStorage(OPEN_GROUPS_KEY);
    if (!raw) return defaultOpenState(pathname);
    return { ...defaultOpenState(pathname), ...JSON.parse(raw) };
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
      className={`group relative flex items-center gap-3 rounded-md px-2.5 py-2 min-h-[40px] transition-colors duration-fast focus-ring ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
      } ${expanded ? "" : "justify-center"}`}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
      <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      {expanded && (
        <span className="flex-1 truncate text-sm">{item.label}</span>
      )}
      <NavBadge count={badge} className={expanded ? "" : "absolute -top-0.5 -right-0.5"} />
    </Link>
  );
}

export default function Sidebar() {
  const { expanded, toggle } = useSidebarState();
  const location = useLocation();
  const badges = useNavBadges();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const pathname = normalizeAppPath(location.pathname);
  const [openGroups, setOpenGroups] = useState(() => loadOpenState(pathname));

  const navItems = useMemo(
    () => filterNavItems(APP_NAV_ITEMS, { isAdmin }),
    [isAdmin]
  );

  const grouped = useMemo(() => {
    const map = {};
    for (const item of navItems) {
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
  }, [badges, pathname, navItems]);

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
      animate={{ width: expanded ? 256 : 72 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
      }
      className="hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-40"
      aria-label="Sidebar"
    >
      {/* Brand + collapse */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-2.5">
        <Link
          to="/"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1.5 focus-ring"
          aria-label="Titan OS home"
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-soft">
            <Zap className="h-4.5 w-4.5 h-4 w-4" aria-hidden="true" />
          </div>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="min-w-0 overflow-hidden"
              >
                <p className="truncate text-sm font-bold tracking-tight text-foreground">Titan OS</p>
                <p className="truncate text-[10px] font-medium text-muted-foreground">Command Center</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          aria-keyshortcuts="Control+B Meta+B"
          title="Toggle sidebar (Ctrl+B)"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-sidebar-accent hover:text-foreground focus-ring"
        >
          {expanded ? (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        {grouped.map((group) => {
          const isOpen = !group.collapsible || openGroups[group.id] || group.hasActive;
          const showItems = expanded ? isOpen : group.id === "daily" || group.hasActive;

          return (
            <div key={group.id} className="mb-1">
              {expanded && group.collapsible && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className={`mb-0.5 flex w-full min-h-[32px] items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors duration-fast focus-ring ${
                    group.hasActive
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  }`}
                >
                  <span className="flex-1 text-[10px] font-bold uppercase tracking-wider">
                    {group.label}
                  </span>
                  {group.badgeTotal > 0 && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {group.badgeTotal}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-fast ${isOpen ? "" : "-rotate-90"}`}
                    aria-hidden="true"
                  />
                </button>
              )}

              {expanded && !group.collapsible && (
                <p className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}

              <AnimatePresence initial={false}>
                {showItems && (
                  <motion.div
                    initial={expanded && !reduceMotion ? { height: 0, opacity: 0 } : false}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
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

      {expanded && (
        <div className="border-t border-sidebar-border px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘B</kbd>
            {" "}toggle sidebar
          </p>
        </div>
      )}
    </motion.aside>
  );
}
