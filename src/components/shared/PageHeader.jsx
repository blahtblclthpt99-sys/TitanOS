import React from "react";
import { Link, useLocation } from "react-router";
import { useReducedMotion, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import TitanAutoLink from "@/components/shared/TitanAutoLink";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const TITAN_AUTO_CONTEXTS = [
  { prefix: "/jobs", source: "jobs" },
  { prefix: "/follow-ups", source: "followups" },
  { prefix: "/companies", source: "business" },
  { prefix: "/customers", source: "business" },
  { prefix: "/invoices", source: "business" },
];

function resolveTitanAutoContext(pathname = "") {
  return TITAN_AUTO_CONTEXTS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)) || null;
}

/**
 * Page title block — clear title, optional breadcrumb, quick actions.
 * Navigation standard: title + actions; Back lives in MobileHeader on nested routes.
 * Titan Auto is surfaced automatically on core work pages so automation stays
 * contextual instead of becoming a separate disconnected destination.
 *
 * @param {{ label: string, to?: string }[]} [breadcrumbs] — last item is current page (no link)
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumbs,
  onAdd,
  addLabel = "Add New",
  actions,
  className,
}) {
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const crumbs = Array.isArray(breadcrumbs) ? breadcrumbs.filter(Boolean) : [];
  const titanAutoContext = resolveTitanAutoContext(location.pathname);

  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("titan-page-header titan-editorial-header flex items-start justify-between gap-4 mb-6", className)}
    >
      <div className="min-w-0 space-y-1.5">
        {crumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb.label}-${i}`}>
                    {i > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem>
                      {last || !crumb.to ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.to}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : eyebrow ? (
          <p className="titan-page-eyebrow text-xs font-medium text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="titan-page-title text-title text-foreground tracking-tight">{title}</h1>
        {subtitle && (
          <p className="titan-page-subtitle text-sm text-muted-foreground leading-relaxed max-w-2xl">{subtitle}</p>
        )}
      </div>
      <div className="titan-page-actions flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
        {titanAutoContext ? <TitanAutoLink source={titanAutoContext.source} /> : null}
        {actions}
        {onAdd && (
          <Button onClick={onAdd} className="gap-2 min-h-[44px]">
            <Plus className="w-4 h-4" aria-hidden="true" /> {addLabel}
          </Button>
        )}
      </div>
    </motion.header>
  );
}
