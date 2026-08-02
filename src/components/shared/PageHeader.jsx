import React from "react";
import { Link } from "react-router";
import { useReducedMotion, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Page title block — clear title, optional breadcrumb, quick actions.
 * Navigation standard: title + actions; Back lives in MobileHeader on nested routes.
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
  const crumbs = Array.isArray(breadcrumbs) ? breadcrumbs.filter(Boolean) : [];

  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("flex items-start justify-between gap-4 mb-6", className)}
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
          <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="text-title text-foreground tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
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
