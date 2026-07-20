import React from "react";
import { Link } from "react-router-dom";
import { Car, ChevronRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { MORE_MENU_GROUPS, navItemsByPaths } from "@/lib/nav-items";
import { useAuth } from "@/lib/AuthContext";
import { betaBadgeLabel } from "@/lib/plan";

export default function MoreMenu() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="More"
        subtitle="All TitanOS tools — marketplace, hire, tax, and more"
      />
      {betaBadgeLabel() && (
        <div className="glass rounded-2xl mb-5 px-4 py-2 border border-titan-cyan/20 text-xs font-semibold text-titan-cyan">
          {betaBadgeLabel()}
        </div>
      )}

      <Link
        to="/driver"
        className="mb-6 flex items-center gap-4 rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-card to-card p-4 min-h-[72px] hover:bg-amber-500/10 transition-colors"
      >
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Car className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Featured</p>
          <p className="text-sm font-bold text-foreground">Driver Hub</p>
          <p className="text-xs text-muted-foreground">Uber, DoorDash, miles & tax</p>
        </div>
        <ChevronRight className="w-5 h-5 text-amber-400 flex-shrink-0" />
      </Link>

      <div className="space-y-6">
        {MORE_MENU_GROUPS.map((group) => {
          const paths = group.paths.filter(
            (path) => path !== "/admin/moderation" || isAdmin
          );
          const items = navItemsByPaths(paths);
          if (!items.length) return null;
          return (
            <section key={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                {group.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`glass glass-hover rounded-2xl p-4 text-left min-h-[96px] flex flex-col gap-3 w-full ${
                      item.path === "/driver" ? "border border-amber-500/30" : ""
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        item.path === "/driver" ? "bg-amber-500/20" : "bg-titan-cyan/15"
                      }`}
                    >
                      <item.icon
                        className={`w-5 h-5 ${item.path === "/driver" ? "text-amber-400" : "text-titan-cyan"}`}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground leading-snug">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
