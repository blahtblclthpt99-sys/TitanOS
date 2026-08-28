/**
 * Founding 100 / trial + price lock + catalog prices (pure).
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FOUNDING_USER_CAP,
  normalizeLaunchStatus,
  applyLaunchStatus,
  isBetaActive,
  isMembershipCheckoutLive,
} from "../src/lib/launchStatus.js";
import {
  isFreeDuringBeta,
  getPlanCheckoutUrl,
  betaBadgeLabel,
  isFoundingUser,
  isFoundingTrialActive,
  canAccessFeature,
  PRO_FEATURES,
  PLANS,
} from "../src/lib/plan.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

beforeEach(() => {
  applyLaunchStatus({
    foundingCap: 100,
    foundingClaimed: 0,
    betaActive: true,
    membershipPaymentsLive: true,
  });
});

describe("founding launch status", () => {
  it("cap is 100", () => {
    assert.equal(FOUNDING_USER_CAP, 100);
  });

  it("normalizes spots; checkout stays live while enrollment open", () => {
    const open = normalizeLaunchStatus({ founding_cap: 100, founding_claimed: 42, beta_active: true });
    assert.equal(open.spotsRemaining, 58);
    assert.equal(open.membershipPaymentsLive, true);

    const closed = normalizeLaunchStatus({
      foundingCap: 100,
      foundingClaimed: 100,
      betaActive: false,
      membershipPaymentsLive: true,
    });
    assert.equal(closed.spotsRemaining, 0);
    assert.equal(closed.membershipPaymentsLive, true);
  });

  it("uses server-created Stripe checkout while founding enrollment is open", () => {
    assert.equal(isFreeDuringBeta(), true);
    assert.equal(isMembershipCheckoutLive(), true);
    assert.equal(getPlanCheckoutUrl("worker_premium"), null);
    assert.equal(getPlanCheckoutUrl("starter"), null);
    const pricing = readFileSync(join(root, "src/pages/Pricing.jsx"), "utf8");
    assert.match(pricing, /startStripeSubscription/);
    assert.doesNotMatch(pricing, /paypal\.com/i);
  });

  it("catalog prices are Starter 4.99 / Pro 9.99 / Business 19.99", () => {
    assert.equal(PLANS.starter.priceMonthly, 4.99);
    assert.equal(PLANS.worker_premium.priceMonthly, 9.99);
    assert.equal(PLANS.worker_premium.mostPopular, true);
    assert.equal(PLANS.business.priceMonthly, 19.99);
  });

  it("founding trial unlocks Pro; expired trial without pay loses AI", () => {
    applyLaunchStatus({ foundingCap: 100, foundingClaimed: 100, betaActive: false, membershipPaymentsLive: true });
    const trial = {
      id: "u1",
      founding_user: true,
      founding_number: 7,
      founding_trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
      founding_price_lock: 9.99,
      founding_locked_plan: "worker_premium",
    };
    assert.ok(isFoundingUser(trial));
    assert.ok(isFoundingTrialActive(trial));
    assert.match(betaBadgeLabel(trial), /Founding #7/);
    assert.equal(canAccessFeature(trial, PRO_FEATURES.driverAddons), true);
    assert.equal(canAccessFeature(trial, PRO_FEATURES.aiAssistant), true);

    const expired = {
      id: "u2",
      founding_user: true,
      founding_number: 8,
      founding_trial_ends_at: new Date(Date.now() - 86400000).toISOString(),
      founding_price_lock: 9.99,
      founding_locked_plan: "worker_premium",
      plan_tier: "worker_free",
      paying_subscriber: false,
      lifetime_premium: false,
    };
    assert.equal(isFoundingTrialActive(expired), false);
    // Driver Hub add-ons are free; AI still requires Pro after trial ends
    assert.equal(canAccessFeature(expired, PRO_FEATURES.driverAddons), true);
    assert.equal(canAccessFeature(expired, PRO_FEATURES.aiAssistant), false);

    const late = { id: "u3", founding_user: false, plan_tier: "worker_free" };
    assert.equal(canAccessFeature(late, PRO_FEATURES.driverAddons), true);
    assert.equal(canAccessFeature(late, PRO_FEATURES.aiAssistant), false);
  });

  it("migrations 035 + 037 ship founding claim and trial lock", () => {
    const m035 = join(root, "supabase/migrations/035_founding_100_beta.sql");
    const m037 = join(root, "supabase/migrations/037_founding_trial_price_lock.sql");
    assert.ok(existsSync(m035));
    assert.ok(existsSync(m037));
    const sql35 = readFileSync(m035, "utf8");
    const sql37 = readFileSync(m037, "utf8");
    assert.match(sql35, /claim_founding_slot/);
    assert.match(sql35, /platform_launch/);
    assert.match(sql37, /founding_trial_ends_at/);
    assert.match(sql37, /founding_price_lock/);
    assert.match(sql37, /9\.99/);
  });

  it("ships a fail-safe platform_launch integrity migration", () => {
    const path = join(root, "supabase/migrations/20260828041500_platform_launch_integrity.sql");
    assert.ok(existsSync(path));
    const sql = readFileSync(path, "utf8");

    assert.match(sql, /pg_advisory_xact_lock\(87231401\)/);
    assert.match(sql, /COUNT\(\*\)::integer[\s\S]*founding_user IS TRUE/i);
    assert.match(sql, /v_actual_claimed > v_cap/i);
    assert.match(sql, /RAISE EXCEPTION[\s\S]*exceeds configured platform_launch founding_cap/i);
    assert.match(sql, /founding_cap BETWEEN 1 AND 1000000/i);
    assert.match(sql, /founding_claimed BETWEEN 0 AND founding_cap/i);
    assert.match(sql, /founding_claimed < founding_cap OR beta_active = false/i);
    assert.doesNotMatch(sql, /SET\s+founding_cap\s*=\s*(?:GREATEST|v_actual_claimed)/i);
  });
});
