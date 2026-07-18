import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useNavBadges } from "@/hooks/useNavBadges";
import { isRouteActive } from "@/lib/nav-utils";
import NavBadge from "@/components/shared/NavBadge";
import { APP_NAV_ITEMS } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";

export default function Sidebar() {
  const { expanded, toggle } = useSidebarState();
  const location = useLocation();
  const badges = useNavBadges();
  const pathname = normalizeAppPath(location.pathname);

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 220 : 72 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="hidden md:flex flex-col h-screen bg-titan-surface0 border-r border-white/5 fixed left-0 top-0 z-40"
      aria-label="Sidebar"
    >
      <div className="flex items-center h-16 px-4 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="ml-3 font-bold text-lg text-white whitespace-nowrap overflow-hidden"
            >
              TitanOS
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {APP_NAV_ITEMS.map((item) => {
          const active = isRouteActive(pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              title={!expanded ? item.label : undefined}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                active
                  ? "bg-titan-cyan/10 text-titan-cyan"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="activeSidebarTab"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-titan-cyan rounded-r-full"
                  transition={{ duration: 0.3 }}
                />
              )}
              <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              <NavBadge count={badges[item.path]} className={expanded ? "" : "absolute -top-1 -right-1"} />
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        aria-expanded={expanded}
        aria-keyshortcuts="Control+B Meta+B"
        title="Toggle sidebar (Ctrl+B)"
        className="flex items-center justify-center h-12 border-t border-white/5 text-white/30 hover:text-white/60 transition-colors"
      >
        {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
}
