import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import ThemeToggle from "@/components/brand/ThemeToggle";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import { MORE_MENU_GROUPS, filterNavItems, navItemsByPaths } from "@/lib/nav-items";
import { useAuth } from "@/lib/AuthContext";
import { isUserAdmin } from "@/lib/isAdmin";
import { betaBadgeLabel } from "@/lib/plan";
import { cn } from "@/lib/utils";

export default function MoreMenu() {
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);

  return (
    <PageShell maxWidth="md">
      <PageHeader
        title="More"
        subtitle="TitanOS domains — Live, History, Analytics, Reports, Communication, AI, Configuration."
      />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <TitanBrandLogo layout="svg" markClassName="h-9 w-9" showTagline />
        <ThemeToggle variant="segmented" className="w-full sm:w-auto sm:min-w-[240px]" />
      </div>

      {betaBadgeLabel() && (
        <div className="mb-6 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-medium text-primary">
          {betaBadgeLabel()}
        </div>
      )}

      <div className="space-y-8">
        {MORE_MENU_GROUPS.map((group) => {
          const paths = group.paths.filter(
            (path) =>
              (path !== "/admin/moderation" && path !== "/admin/fees" && path !== "/admin/tax-rules") || isAdmin
          );
          const items = filterNavItems(navItemsByPaths(paths), { isAdmin });
          if (!items.length) return null;

          return (
            <section key={group.title} aria-labelledby={`more-${group.title}`}>
              <div className="mb-3 px-0.5">
                <h2
                  id={`more-${group.title}`}
                  className="text-caption font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {group.title}
                </h2>
                {group.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground/80">{group.description}</p>
                )}
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        "titan-surface titan-surface-interactive flex min-h-[64px] items-center gap-3 p-3.5 focus-ring",
                        item.beta && "border-primary/15"
                      )}
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <item.icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground leading-snug">
                          {item.label}
                        </p>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
