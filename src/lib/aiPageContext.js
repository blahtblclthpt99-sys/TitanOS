/**
 * Client page context packet for Titan AI (allowlisted fields only).
 */
import { resolveNavDomain, resolvePageTitle } from "@/lib/nav-items";

/**
 * @param {{ pathname?: string, search?: string, entityType?: string, entityId?: string, workflow?: string }} [opts]
 */
export function buildAiPageContext(opts = {}) {
  if (typeof window === "undefined" && !opts.pathname) return null;
  const pathname = opts.pathname || window.location?.pathname || "/";
  const search = opts.search ?? window.location?.search ?? "";
  const domain = resolveNavDomain(pathname) || "unknown";
  const title = resolvePageTitle(pathname) || document?.title || "TitanOS";

  let entityType = opts.entityType || null;
  let entityId = opts.entityId || null;
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (!entityId && params.get("id")) entityId = params.get("id");
    if (!entityType && params.get("entity")) entityType = params.get("entity");
  } catch {
    /* ignore */
  }

  return {
    path: pathname,
    title: String(title).slice(0, 120),
    domain: String(domain).slice(0, 40),
    entityType: entityType ? String(entityType).slice(0, 40) : null,
    entityId: entityId ? String(entityId).slice(0, 80) : null,
    workflow: opts.workflow ? String(opts.workflow).slice(0, 60) : null,
  };
}
