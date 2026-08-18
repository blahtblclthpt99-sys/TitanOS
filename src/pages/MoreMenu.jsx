import React from "react";
import { Link } from "react-router";
import {
  ChevronRight,
  CircleHelp,
  Settings,
  ShieldCheck,
  Trash2,
  UserCircle,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import ThemeToggle from "@/components/brand/ThemeToggle";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import { MORE_MENU_GROUPS, filterNavItems, navItemsByPaths } from "@/lib/nav-items";
import { useAuth } from "@/lib/AuthContext";
import { betaBadgeLabel } from "@/lib/plan";
import { cn } from "@/lib/utils";

const ACCOUNT_LINKS = [
  { label: "Profile", description: "Business owner and account details", path: "/profile", icon: UserCircle },
  { label: "Settings", description: "Preferences, integrations, and configuration", path: "/settings", icon: Settings },
  { label: "Titan Support", description: "Get help with TitanOS", path: "/support", icon: CircleHelp },
  { label: "Trust & Safety", description: "Safety, privacy, and platform policies", path: "/trust-safety", icon: ShieldCheck },
];

export default function MoreMenu() {
  const { user } = useAuth();

  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="TitanOS Business"
        title="Business Tools"
        subtitle="Everything beyond the daily Home, Jobs, Customers, and Money tabs — organized around running a real business."
      />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <TitanBrandLogo layout="svg" markClassName="h-9 w-9" showTagline />
        <ThemeToggle variant="segmented" className="w-full sm:w-auto sm:min-w-[240px]" />
      </div>

      {betaBadgeLabel(user) && (
        <div className="mb-6 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-medium text-primary">
          {betaBadgeLabel(user)}
        </div>
      )}

      <div className="space-y-8">
        {MORE_MENU_GROUPS.map((group) => {
          const items = filterNavItems(navItemsByPaths(group.paths));
          if (!items.length) return null;

          return (
            <section key={group.title} aria-labelledby={`more-${group.title}`}>
              <div className="mb-3 px-0.5">
                <h2 id={`more-${group.title}`} className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h2>
                {group.description ? <p className="mt-0.5 text-xs text-muted-foreground/80">{group.description}</p> : null}
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        "titan-surface titan-surface-interactive flex min-h-[72px] items-center gap-3 p-3.5 focus-ring",
                        item.beta && "border-primary/15"
                      )}
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <item.icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-foreground">{item.label}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section aria-labelledby="more-account">
          <div className="mb-3 px-0.5">
            <h2 id="more-account" className="text-caption font-bold uppercase tracking-wider text-muted-foreground">Account & support</h2>
            <p className="mt-0.5 text-xs text-muted-foreground/80">Configuration and help, kept separate from the business product surface.</p>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ACCOUNT_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link to={item.path} className="titan-surface titan-surface-interactive flex min-h-[78px] items-center gap-3 p-3.5 focus-ring">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <Link
        to="/delete-account"
        className="mt-8 flex min-h-[72px] items-center gap-4 rounded-xl border border-red-500/15 bg-card p-4 focus-ring"
      >
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Delete account & data</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Submit a verified account-deletion request and review retention details.</p>
        </div>
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </PageShell>
  );
}
