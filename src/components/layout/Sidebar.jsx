import React, { useMemo } from "react";
import { Link, useLocation } from "react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useNavBadges } from "@/hooks/useNavBadges";
import { isRouteActive } from "@/lib/nav-utils";
import NavBadge from "@/components/shared/NavBadge";
import { NAV_GROUP_META, NAV_GROUP_ORDER, navItemsForUser } from "@/lib/nav-items";
import { normalizeAppPath } from "@/lib/routing";
import { useAuth } from "@/lib/AuthContext";
import { accountHomePath, accountLabel } from "@/lib/accountExperience";
import TitanMark from "@/components/brand/TitanMark";
import TitanWordmark from "@/components/brand/TitanWordmark";

function NavLink({ item, expanded, active, badge }) {
  return (
    <Link
      to={item.path}
      title={!expanded ? item.label : undefined}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`titan-nav-link group relative flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-fast focus-ring ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
      } ${expanded ? "" : "justify-center"}`}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_rgba(34,211,238,0.6)]"
          aria-hidden="true"
        />
      ) : null}
      <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      {expanded ? <span className="flex-1 truncate text-sm">{item.label}</span> : null}
      <NavBadge count={badge} className={expanded ? "" : "absolute -top-0.5 -right-0.5"} />
    </Link>
  );
}

export default function Sidebar() {
  const { expanded, toggle } = useSidebarState();
  const { user } = useAuth();
  const location = useLocation();
  const badges = useNavBadges();
  const pathname = normalizeAppPath(location.pathname);
  const items = useMemo(() => navItemsForUser(user), [user]);
  const homePath = accountHomePath(user);
  const workspaceLabel = accountLabel(user);

  const grouped = useMemo(() => {
    const map = {};
    for (const item of items) {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    }
    return NAV_GROUP_ORDER.filter((group) => map[group]?.length).map((group) => ({
      id: group,
      label: NAV_GROUP_META[group]?.label || group,
      items: map[group],
    }));
  }, [items]);

  return (
    <aside
      className={`titan-sidebar hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-40 transition-[width] duration-200 ${expanded ? "w-64" : "w-[72px]"}`}
      aria-label={`TitanOS ${workspaceLabel} navigation`}
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-2.5">
        <Link
          to={homePath}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1.5 focus-ring"
          aria-label={`TitanOS ${workspaceLabel} home`}
        >
          <TitanMark className="h-10 w-10 flex-shrink-0" />
          {expanded ? (
            <div className="min-w-0 overflow-hidden">
              <TitanWordmark size="sm" />
              <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-primary/75">
                {workspaceLabel}
              </p>
            </div>
          ) : null}
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
          {expanded ? <PanelLeftClose className="h-4 w-4" aria-hidden="true" /> : <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        {grouped.map((group) => (
          <div key={group.id}>
            {expanded ? (
              <p className="px-2.5 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[0.17em] text-muted-foreground">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  item={item}
                  expanded={expanded}
                  active={isRouteActive(pathname, item.path)}
                  badge={badges[item.path]}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
