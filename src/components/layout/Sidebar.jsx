import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useNavBadges } from "@/hooks/useNavBadges";
import { isRouteActive } from "@/lib/nav-utils";
import NavBadge from "@/components/shared/NavBadge";
import { APP_NAV_ITEMS, NAV_GROUP_LABELS } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";

const GROUP_ORDER = ["core", "ops", "growth", "insights", "account"];

export default function Sidebar() {
  const { expanded, toggle } = useSidebarState();
  const location = useLocation();
  const badges = useNavBadges();
  const pathname = normalizeAppPath(location.pathname);

  const grouped = useMemo(() => {
    const map = {};
    for (const item of APP_NAV_ITEMS) {
      const g = item.group || "core";
      if (!map[g]) map[g] = [];
      map[g].push(item);
    }
    return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({
      id: g,
      label: NAV_GROUP_LABELS[g] || g,
      items: map[g],
    }));
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 248 : 72 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-40 shadow-soft"
      aria-label="Sidebar"
    >
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-titan-navy to-titan-electric flex items-center justify-center flex-shrink-0 shadow-soft">
          <Zap className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="ml-3 font-bold text-lg text-foreground whitespace-nowrap overflow-hidden"
            >
              TitanOS
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto" aria-label="Main navigation">
        {grouped.map((group) => (
          <div key={group.id}>
            {expanded && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isRouteActive(pathname, item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={!expanded ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative min-h-[44px] ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="activeSidebarTab"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                        transition={{ duration: 0.25 }}
                      />
                    )}
                    <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <AnimatePresence>
                      {expanded && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="text-sm whitespace-nowrap overflow-hidden flex-1"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <NavBadge count={badges[item.path]} className={expanded ? "" : "absolute -top-1 -right-1"} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        aria-expanded={expanded}
        aria-keyshortcuts="Control+B Meta+B"
        title="Toggle sidebar (Ctrl+B)"
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
      >
        {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
}
