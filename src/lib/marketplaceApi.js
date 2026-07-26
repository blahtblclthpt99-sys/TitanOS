import { api } from "@/api/apiClient";
import {
  getCatalogModules,
  MARKETPLACE_MODULES,
  MODULE_PRICE,
  normalizeModule,
} from "@/lib/marketplaceCatalog";
import { createPaymentLink } from "@/lib/paymentsApi";
import { isLocalOrStub } from "@/lib/dataSource";

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
 * Install a module. During beta (price $0) unlocks immediately with no Stripe.
 * Paid modules charge via Stripe, then unlock.
 */
export async function purchaseAndInstallModule(user, module) {
  const existing = await fetchUserInstalls(user.id);
  if (existing.some((i) => i.module_slug === module.slug && i.status !== "uninstalled")) {
    return { payment: null, installed: existing.find((i) => i.module_slug === module.slug), alreadyOwned: true };
  }

  const amount = Number(module.price);
  const charge = Number.isFinite(amount) && amount > 0 ? amount : MODULE_PRICE;

  // Free beta / $0 modules — install without checkout
  if (!(charge > 0)) {
    const installed = await installModule(user, module);
    return { payment: null, installed, alreadyOwned: false, free: true };
  }

  const payment = await createPaymentLink(user, {
    amount: charge,
    customer_name: `Module: ${module.name}`,
    note: `module:${module.slug}`,
    purpose: "module",
  });

  if (isLocalOrStub(payment) || !payment.checkout_url) {
    const err = new Error(
      payment?.message || "Checkout isn't available. Configure Stripe to purchase modules."
    );
    err.code = "MODULE_CHECKOUT_UNAVAILABLE";
    throw err;
  }

  const installed = await installModule(user, module);
  return { payment, installed, alreadyOwned: false };
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
