/**
 * Production hardening smoke tests (pure / structural).
 * Run: node --test scripts/production-hardening.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Sentry wiring", () => {
  it("client sentry sets release/environment, tracing, and privacy-safe replay hooks", () => {
    const src = read("src/lib/sentry.js");
    assert.match(src, /release:/);
    assert.match(src, /setSentryUser/);
    assert.match(src, /clearSentryUser/);
    assert.match(src, /sendDefaultPii:\s*false/);
    assert.match(src, /browserTracingIntegration/);
    assert.match(src, /maskAllText/);
  });

  it("API instrument initializes with traces and flush path", () => {
    const instrument = read("api/instrument.mjs");
    const helper = read("api/_lib/sentry.js");
    assert.match(instrument, /tracesSampleRate/);
    assert.match(helper, /Sentry\.flush/);
    assert.match(helper, /captureApiException/);
  });
});

describe("Health readiness", () => {
  it("exposes readiness and optional Stripe deep check", () => {
    const src = read("api/functions/health.js");
    assert.match(src, /readiness/);
    assert.match(src, /api\.stripe\.com\/v1\/balance/);
    assert.match(src, /sentryConfigured/);
    assert.match(src, /paypalConfigured/);
    assert.match(src, /opsAlertConfigured/);
    assert.match(src, /observability/);
  });
});

describe("Stripe money path guards", () => {
  it("fails closed without STRIPE_SECRET_KEY and uses Idempotency-Key", () => {
    const src = read("api/functions/createPaymentLink.js");
    assert.match(src, /Stripe is not configured/);
    assert.match(src, /Idempotency-Key/);
    assert.match(src, /assertRateLimit/);
  });

  it("webhook verifies signature before processing", () => {
    const src = read("api/functions/stripeWebhook.js");
    assert.match(src, /constructEvent/);
    assert.match(src, /stripe_webhook_events/);
  });
});

describe("PayPal membership path", () => {
  it("webhook verifies via PayPal API and uses idempotency table", () => {
    const src = read("api/functions/paypalWebhook.js");
    assert.match(src, /verifyPayPalWebhook/);
    assert.match(src, /paypal_webhook_events/);
    assert.match(src, /assertRateLimit/);
  });

  it("maps checkout amounts to plan tiers", async () => {
    const { planTierFromAmount, extractPayerEmail } = await import("../api/_lib/paypal.js");
    assert.equal(planTierFromAmount(29.99), "worker_premium");
    assert.equal(planTierFromAmount(49.99), "business");
    assert.equal(planTierFromAmount(10), null);
    assert.equal(
      extractPayerEmail({ payer: { email_address: "a@b.com" } }),
      "a@b.com"
    );
  });
});

describe("Marketplace free + payment fees", () => {
  it("marketplace catalog modules are priced at PayPal module NCP ($1.99)", async () => {
    const { MODULE_PRICE, MODULE_PRICE_LABEL, MARKETPLACE_MODULES, formatModulePrice } = await import(
      "../src/lib/marketplaceCatalog.js"
    );
    assert.equal(MODULE_PRICE, 1.99);
    assert.equal(MODULE_PRICE_LABEL, "");
    assert.ok(MARKETPLACE_MODULES.length >= 25);
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "law-mastermind-ai"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "babysitting-pro"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "window-installer"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "carpet-layer"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "tile-setter"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "sheetrock-finisher"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "trim-work"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "mobile-car-wash"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "mobile-mechanic"));
    assert.ok(MARKETPLACE_MODULES.some((m) => m.slug === "christmas-light-installer"));
    assert.ok(MARKETPLACE_MODULES.every((m) => Number(m.price) === 1.99));
    assert.equal(formatModulePrice({ price: 1.99 }), "$1.99");
  });

  it("createPaymentLink supports module purpose without service fee", () => {
    const src = read("api/functions/createPaymentLink.js");
    assert.match(src, /service_requests/);
    assert.match(src, /purpose === "module"/);
    assert.match(src, /marketplace_sales/);
    assert.match(src, /calculateCategoryFees/);
  });
});

describe("Security headers & rate limits", () => {
  it("vercel.json includes CSP and HSTS", () => {
    const src = read("vercel.json");
    assert.match(src, /Content-Security-Policy/);
    assert.match(src, /Strict-Transport-Security/);
  });

  it("portal mutate routes are rate-limited", () => {
    assert.match(read("api/functions/portalAcceptEstimate.js"), /assertRateLimit/);
    assert.match(read("api/functions/portalLeaveReview.js"), /assertRateLimit/);
  });
});

describe("Critical migrations on disk", () => {
  const required = [
    "supabase/migrations/018_stripe_webhook_idempotency.sql",
    "supabase/migrations/019_production_security_lockdown.sql",
    "supabase/migrations/021_privilege_money_integrity.sql",
    "supabase/migrations/022_driver_profiles.sql",
    "supabase/migrations/023_protect_driver_id_verified.sql",
    "supabase/migrations/024_driver_vehicle_capacity.sql",
    "supabase/migrations/025_job_location_tax_engine.sql",
    "supabase/migrations/026_protect_driver_trust_fields.sql",
    "supabase/migrations/027_paypal_webhook_events.sql",
    "supabase/migrations/028_marketplace_free.sql",
    "supabase/migrations/029_marketplace_module_price.sql",
    "supabase/migrations/030_titan_comms.sql",
    "supabase/migrations/031_titancom_channel_rules.sql",
    "supabase/migrations/032_database_integrity_lockdown.sql",
    "supabase/migrations/033_audit_events.sql",
    "supabase/migrations/034_scalability_hot_paths.sql",
  ];
  for (const file of required) {
    it(`has ${file}`, () => {
      assert.ok(existsSync(join(root, file)), `missing ${file}`);
    });
  }
});

describe("Critical workflow surfaces (structural)", () => {
  it("auth pages and register API exist", () => {
    for (const f of [
      "src/pages/Login.jsx",
      "src/pages/Register.jsx",
      "src/pages/ForgotPassword.jsx",
      "src/pages/ResetPassword.jsx",
      "api/register.js",
    ]) {
      assert.ok(existsSync(join(root, f)), `missing ${f}`);
    }
    assert.match(read("api/register.js"), /assertRateLimit|captureApiException/);
  });

  it("Driver Hub, Dashboard, Estimates, Payments, Profile, TitanCom routes exist", () => {
    for (const f of [
      "src/pages/Dashboard.jsx",
      "src/pages/Estimates.jsx",
      "src/pages/Payments.jsx",
      "src/pages/Profile.jsx",
      "src/pages/DriverHub.jsx",
      "src/pages/TitanComms.jsx",
      "src/lib/titanCommsApi.js",
      "src/lib/titanCommsPtt.js",
    ]) {
      assert.ok(existsSync(join(root, f)), `missing ${f}`);
    }
    assert.match(read("src/components/layout/TabStack.jsx"), /\/comms/);
    assert.match(read("src/lib/nav-items.js"), /TitanCom/);
    assert.match(read("src/lib/nav-items.js"), /path:\s*"\/comms"/);
  });

  it("AuthContext clears Sentry user on logout path", () => {
    const src = read("src/lib/AuthContext.jsx");
    assert.match(src, /applyUser/);
    assert.match(src, /clearSentryUser|setSentryUser/);
  });

  it("026 migration protects driver trust fields", () => {
    const sql = read("supabase/migrations/026_protect_driver_trust_fields.sql");
    assert.match(sql, /protect_driver_trust_fields/);
    assert.match(sql, /insured/);
    assert.match(sql, /background_checked/);
  });
});

describe("Scale / concurrent-session hardening", () => {
  it("entity adapter caps page size and exposes count() + filterPage", () => {
    const src = read("src/api/entityAdapter.js");
    assert.match(src, /DEFAULT_ENTITY_PAGE_SIZE\s*=\s*100/);
    assert.match(src, /MAX_ENTITY_PAGE_SIZE\s*=\s*500/);
    assert.match(src, /PREFERRED_ENTITY_PAGE_SIZE\s*=\s*100/);
    assert.match(src, /async count\(/);
    assert.match(src, /async filterPage\(/);
    assert.match(src, /resolvePageSize/);
  });

  it("shell notifications share one unread query (no dual interval polls)", () => {
    const hook = read("src/hooks/useUnreadNotificationCount.js");
    const bell = read("src/components/shared/NotificationBell.jsx");
    const center = read("src/components/layout/NotificationCenter.jsx");
    assert.match(hook, /refetchInterval/);
    assert.match(hook, /visibilityState/);
    assert.match(bell, /useUnreadNotificationCount/);
    assert.match(center, /useUnreadNotificationCount/);
    assert.doesNotMatch(bell, /setInterval/);
    assert.doesNotMatch(center, /setInterval\(refreshCount/);
  });

  it("reconnect refetch is jittered; auth skips TOKEN_REFRESHED profile hammer", () => {
    const qc = read("src/lib/query-client.js");
    const auth = read("src/lib/AuthContext.jsx");
    assert.match(qc, /refetchOnReconnect:\s*false/);
    assert.match(qc, /Math\.random/);
    assert.match(auth, /TOKEN_REFRESHED/);
    assert.match(auth, /INITIAL_SESSION/);
  });

  it("CustomerDetail scopes related entities by customer_id", () => {
    const src = read("src/pages/CustomerDetail.jsx");
    assert.match(src, /customer_id:\s*id/);
    assert.doesNotMatch(src, /list", args: \["-scheduled_date", 500\]/);
  });

  it("documents scale readiness and load profile", () => {
    assert.ok(existsSync(join(root, "docs/SCALE_READINESS.md")));
    assert.match(read("scripts/load-test.mjs"), /scale:/);
  });
});
