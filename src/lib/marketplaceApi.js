import { api } from "@/api/apiClient";
import {
  getCatalogModules,
  MARKETPLACE_MODULES,
  MODULE_PRICE,
  normalizeModule,
} from "@/lib/marketplaceCatalog";

const STORAGE_PREFIX = "titanos_marketplace";

function storageKey(userId, suffix) {
  return `${STORAGE_PREFIX}_${suffix}_${userId}`;
}

function readLocal(userId, suffix) {
  try {
    const raw = localStorage.getItem(storageKey(userId, suffix));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(userId, suffix, value) {
  localStorage.setItem(storageKey(userId, suffix), JSON.stringify(value));
}

function entityAvailable(entityName) {
  return Boolean(api.entities?.[entityName]);
}

export async function fetchMarketplaceModules() {
  // Static catalog is source of truth so new modules always appear.
  const catalog = getCatalogModules();
  if (!entityAvailable("MarketplaceModule")) return catalog;

  try {
    const remote = await api.entities.MarketplaceModule.list("-install_count", 200);
    if (!remote?.length) return catalog;
    const bySlug = new Map(remote.map((row) => [row.slug, row]));
    return MARKETPLACE_MODULES.map((mod) => {
      const remoteRow = bySlug.get(mod.slug);
      return normalizeModule(remoteRow ? { ...mod, ...remoteRow, price: MODULE_PRICE } : mod);
    });
  } catch {
    return catalog;
  }
}

export async function fetchUserInstalls(userId) {
  if (!userId) return [];

  if (entityAvailable("ModuleInstall")) {
    try {
      const installs = await api.entities.ModuleInstall.filter({ user_id: userId });
      return installs.filter((install) => install.status === "active");
    } catch {
      // fall through to local storage
    }
  }

  return readLocal(userId, "installs");
}

export async function fetchUserWaitlist(userId) {
  if (!userId) return [];

  if (entityAvailable("ModuleWaitlist")) {
    try {
      return await api.entities.ModuleWaitlist.filter({ user_id: userId });
    } catch {
      // fall through to local storage
    }
  }

  return readLocal(userId, "waitlist");
}

export async function installModule(user, module) {
  const payload = {
    user_id: user.id,
    module_slug: module.slug,
    module_name: module.name,
    status: "active",
    installed_at: new Date().toISOString(),
  };

  if (entityAvailable("ModuleInstall")) {
    try {
      const existing = await api.entities.ModuleInstall.filter({
        user_id: user.id,
        module_slug: module.slug,
      });
      const active = existing.find((item) => item.status === "active");
      if (active) return active;

      const stale = existing[0];
      if (stale) {
        return await api.entities.ModuleInstall.update(stale.id, {
          status: "active",
          installed_at: payload.installed_at,
        });
      }

      return await api.entities.ModuleInstall.create(payload);
    } catch {
      // fall through to local storage
    }
  }

  const installs = readLocal(user.id, "installs");
  if (!installs.some((item) => item.module_slug === module.slug)) {
    installs.push(payload);
    writeLocal(user.id, "installs", installs);
  }
  return payload;
}

/**
 * Install a module. Entitled via Pro/Business, founding trial, or $0.99 pack unlock.
 * If locked, opens the Marketplace Modules PayPal NCP ($0.99 · all modules).
 */
export async function purchaseAndInstallModule(user, module) {
  const { canUseMarketplaceApps, getModulesCheckoutUrl } = await import("@/lib/plan");
  if (!canUseMarketplaceApps(user)) {
    const checkoutUrl = getModulesCheckoutUrl();
    if (checkoutUrl && typeof window !== "undefined") {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    }
    const err = new Error(
      checkoutUrl
        ? "Unlock all Marketplace modules for $0.99 in PayPal (use the same email as TitanOS), then return and install. Or upgrade to Pro."
        : "Unlock Marketplace modules for $0.99 or upgrade to Pro ($9.99)."
    );
    err.code = "MARKETPLACE_APPS_LOCKED";
    err.checkoutUrl = checkoutUrl || null;
    throw err;
  }

  const existing = await fetchUserInstalls(user.id);
  if (existing.some((i) => i.module_slug === module.slug && i.status !== "uninstalled")) {
    return { payment: null, installed: existing.find((i) => i.module_slug === module.slug), alreadyOwned: true };
  }

  try {
    const result = await api.functions.invoke("installMarketplaceModule", {
      module_slug: module.slug,
      module_name: module.name,
    });
    const data = result?.data || result;
    if (data?.installed) {
      return {
        payment: null,
        installed: data.installed,
        alreadyOwned: Boolean(data.alreadyOwned),
        free: true,
      };
    }
  } catch (error) {
    if (error?.status === 403 || error?.code === "PLAN_REQUIRED") {
      const checkoutUrl = getModulesCheckoutUrl();
      if (checkoutUrl && typeof window !== "undefined") {
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      }
      const err = new Error(
        error.message ||
          "Unlock Marketplace modules for $0.99 or upgrade to Pro ($9.99)."
      );
      err.code = "MARKETPLACE_APPS_LOCKED";
      err.checkoutUrl = checkoutUrl || null;
      throw err;
    }
    // Offline / API gap — client install still requires canUseMarketplaceApps above
  }

  const installed = await installModule(user, module);
  return { payment: null, installed, alreadyOwned: false, free: true, catalogPrice: MODULE_PRICE };
}

export async function uninstallModule(user, moduleSlug) {
  if (entityAvailable("ModuleInstall")) {
    try {
      const existing = await api.entities.ModuleInstall.filter({
        user_id: user.id,
        module_slug: moduleSlug,
      });
      const active = existing.find((item) => item.status === "active");
      if (active) {
        return await api.entities.ModuleInstall.update(active.id, { status: "uninstalled" });
      }
      return null;
    } catch {
      // fall through to local storage
    }
  }

  const installs = readLocal(user.id, "installs").filter((item) => item.module_slug !== moduleSlug);
  writeLocal(user.id, "installs", installs);
  return null;
}

export async function joinWaitlist(user, module) {
  const payload = {
    user_id: user.id,
    user_email: user.email,
    module_slug: module.slug,
    module_name: module.name,
  };

  if (entityAvailable("ModuleWaitlist")) {
    try {
      const existing = await api.entities.ModuleWaitlist.filter({
        user_id: user.id,
        module_slug: module.slug,
      });
      if (existing.length > 0) return existing[0];
      return await api.entities.ModuleWaitlist.create(payload);
    } catch {
      // fall through to local storage
    }
  }

  const waitlist = readLocal(user.id, "waitlist");
  if (!waitlist.some((item) => item.module_slug === module.slug)) {
    waitlist.push({ ...payload, created_at: new Date().toISOString() });
    writeLocal(user.id, "waitlist", waitlist);
  }
  return payload;
}

export async function submitDeveloperApplication(user, { company, description }) {
  const payload = {
    user_id: user.id,
    user_email: user.email,
    company: company.trim(),
    description: description.trim(),
    status: "pending",
  };

  if (entityAvailable("DeveloperApplication")) {
    try {
      const record = await api.entities.DeveloperApplication.create(payload);
      await api.integrations.Core.SendEmail({
        to: user.email,
        from_name: "TitanOS",
        subject: "Developer application received",
        body:
          `Hi ${user.full_name || "there"},\n\n` +
          `Thanks for applying to build on the TitanOS Marketplace. Our team will review your application for ${company.trim()} and get back to you within 2 business days.\n\n` +
          `— The TitanOS Team`,
      });
      return record;
    } catch {
      // fall through to local storage
    }
  }

  const applications = readLocal(user.id, "developer_apps");
  const record = { ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString() };
  applications.push(record);
  writeLocal(user.id, "developer_apps", applications);
  return record;
}

export function hasLawMastermind(installs = []) {
  return installs.some((i) => i.module_slug === "law-mastermind-ai" && i.status !== "uninstalled");
}
