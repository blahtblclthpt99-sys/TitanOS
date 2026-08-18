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

  it("keeps Node instrumentation optional while the shared API capture path is edge-safe", () => {
    const instrument = read("api/instrument.mjs");
    const helper = read("api/_lib/sentry.js");
    assert.match(instrument, /tracesSampleRate/);
    assert.match(helper, /captureApiException/);
    assert.match(helper, /application\/x-sentry-envelope/);
    assert.match(helper, /async flush/);
    assert.doesNotMatch(helper, /@sentry\/node|@sentry\/profiling-node|\.\.\/instrument\.mjs/);
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

describe("Marketplace free + payment fees", () => {
  it("marketplace modules are $0.99 pack (all modules)", async () => {
    const { MODULE_PRICE, MODULE_PRICE_LABEL, MARKETPLACE_MODULES, formatModulePrice } = await import(
      "../src/lib/marketplaceCatalog.js"
    );
    assert.equal(MODULE_PRICE, 0.99);
    assert.match(MODULE_PRICE_LABEL, /0\.99/i);
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
    assert.equal(formatModulePrice(), "$0.99");
  });

  it("createPaymentLink supports module purpose without service fee", () => {
    const src = read("api/functions/createPaymentLink.js");
    assert.match(src, /purpose === "module"/);
    assert.match(src, /service_fee_cents:\s*0/);
  });
});

describe("Security headers & rate limits", () => {
  it("vercel.json includes CSP and HSTS", () => {
    const src = read("vercel.json");
    assert.match(src, /Content-Security-Policy/);
    assert.match(src, /Strict-Transport-Security/);
  });

  it("portal mutate routes are rate-limited", () => {
    for (const rel of [
      "api/functions/portalRequestOtp.js",
      "api/functions/portalVerifyOtp.js",
      "api/functions/portalMessage.js",
      "api/functions/portalApproveEstimate.js",
      "api/functions/portalPaymentLink.js",
    ]) {
      assert.match(read(rel), /assertRateLimit/);
    }
  });
});

describe("Authentication trust boundary", () => {
  it("auth/me requires server-verified Supabase user state", () => {
    const src = read("api/auth/me.js");
    assert.match(src, /auth\.getUser/);
    assert.doesNotMatch(src, /decode.*jwt|atob\(/i);
  });

  it("OAuth callback has bounded exchange and profile initialization", () => {
    const src = read("src/pages/AuthCallback.jsx");
    assert.match(src, /exchangeCodeForSession/);
    assert.match(src, /ensureProfile/);
  });
});

describe("Critical migrations on disk", () => {
  for (const migration of [
    "018_stripe_webhook_idempotency.sql",
    "019_production_security_lockdown.sql",
    "021_privilege_money_integrity.sql",
    "022_driver_profiles.sql",
    "023_protect_driver_id_verified.sql",
    "024_driver_vehicle_capacity.sql",
    "025_job_location_tax_engine.sql",
    "026_protect_driver_trust_fields.sql",
    "027_paypal_webhook_events.sql",
    "028_marketplace_free.sql",
    "029_marketplace_module_price.sql",
    "030_titan_comms.sql",
    "031_titancom_channel_rules.sql",
    "032_database_integrity_lockdown.sql",
    "033_audit_events.sql",
    "034_scalability_hot_paths.sql",
    "035_founding_100_beta.sql",
    "036_marketplace_modules_subscription_only.sql",
    "037_founding_trial_price_lock.sql",
    "038_marketplace_pack_unlocked.sql",
  ]) {
    it(`has supabase/migrations/${migration}`, () => {
      assert.ok(existsSync(join(root, "supabase/migrations", migration)));
    });
  }
});

describe("Critical workflow surfaces (structural)", () => {
  it("auth pages and register API exist", () => {
    assert.ok(existsSync(join(root, "src/pages/Login.jsx")));
    assert.ok(existsSync(join(root, "src/pages/Register.jsx")));
    assert.ok(existsSync(join(root, "api/register.js")));
  });

  it("three-sided work OS surfaces and essential business workflows exist", () => {
    for (const rel of [
      "src/pages/JobSeekerProfile.jsx",
      "src/pages/JobMatches.jsx",
      "src/pages/IndependentWork.jsx",
      "src/pages/WorkOpportunities.jsx",
      "src/pages/ServiceProfile.jsx",
      "src/pages/Jobs.jsx",
      "src/pages/Customers.jsx",
      "src/pages/Invoices.jsx",
      "src/pages/Payments.jsx",
      "src/pages/Autopilot.jsx",
    ]) {
      assert.ok(existsSync(join(root, rel)), `${rel} must exist`);
    }
  });

  it("AuthContext clears Sentry user on logout path", () => {
    assert.match(read("src/lib/AuthContext.jsx"), /clearSentryUser/);
  });

  it("026 migration protects driver trust fields", () => {
    const sql = read("supabase/migrations/026_protect_driver_trust_fields.sql");
    assert.match(sql, /id_verified/);
    assert.match(sql, /prevent|protect|trigger/i);
  });
});

describe("Scale / concurrent-session hardening", () => {
  it("entity adapter caps page size and exposes count() + filterPage", () => {
    const src = read("src/api/entities.js");
    assert.match(src, /filterPage/);
    assert.match(src, /count/);
    assert.match(src, /limit/);
  });

  it("shell notifications share one unread query (no dual interval polls)", () => {
    const src = read("src/components/layout/AppLayout.jsx");
    assert.doesNotMatch(src, /setInterval\([^)]*notification/i);
  });

  it("reconnect refetch is jittered; auth skips TOKEN_REFRESHED profile hammer", () => {
    const query = read("src/lib/queryClient.js");
    const auth = read("src/lib/AuthContext.jsx");
    assert.match(query, /jitter|Math\.random/i);
    assert.match(auth, /TOKEN_REFRESHED/);
  });

  it("CustomerDetail scopes related entities by customer_id", () => {
    const src = read("src/pages/CustomerDetail.jsx");
    assert.match(src, /customer_id/);
  });

  it("documents scale readiness and load profile", () => {
    assert.ok(existsSync(join(root, "docs/SCALE_READINESS.md")));
    assert.ok(existsSync(join(root, "scripts/load-test.mjs")));
  });
});
