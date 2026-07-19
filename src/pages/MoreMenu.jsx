import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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

      <div className="space-y-6">
        {MORE_MENU_GROUPS.map((group, groupIndex) => {
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
                {items.map((item, i) => (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: groupIndex * 0.04 + i * 0.03 }}
                  >
                    <Link
                      to={item.path}
                      className="glass glass-hover rounded-2xl p-4 text-left min-h-[96px] flex flex-col gap-3 w-full"
                    >
                      <div className="w-10 h-10 rounded-xl bg-titan-cyan/15 flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-titan-cyan" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-semibold text-foreground leading-snug">
                        {item.label}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
