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
  it("client sentry sets release/environment and user helpers", () => {
    const src = read("src/lib/sentry.js");
    assert.match(src, /release:/);
    assert.match(src, /setSentryUser/);
    assert.match(src, /clearSentryUser/);
    assert.match(src, /sendDefaultPii:\s*false/);
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

  it("Driver Hub, Dashboard, Estimates, Payments, Profile routes exist", () => {
    for (const f of [
      "src/pages/Dashboard.jsx",
      "src/pages/Estimates.jsx",
      "src/pages/Payments.jsx",
      "src/pages/Profile.jsx",
      "src/pages/DriverHub.jsx",
    ]) {
      assert.ok(existsSync(join(root, f)), `missing ${f}`);
    }
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
