import { api } from "@/api/apiClient";
import {
  MARKETPLACE_MODULES,
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

async function trySeedCatalog() {
  if (!entityAvailable("MarketplaceModule")) return null;
  try {
    const modules = await api.entities.MarketplaceModule.list("-install_count", 100);
    if (modules.length > 0) return modules;
    if (api.functions?.invoke) {
      const result = await api.functions.invoke("seedMarketplace", {});
      return result?.modules ?? [];
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchMarketplaceModules() {
  const seeded = await trySeedCatalog();
  if (seeded?.length) return seeded.map(normalizeModule);

  return MARKETPLACE_MODULES.map(normalizeModule);
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
