/**
 * Founding 100 / beta launch status helpers (pure).
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
  getLaunchStatus,
} from "../src/lib/launchStatus.js";
import {
  isFreeDuringBeta,
  getPlanCheckoutUrl,
  betaBadgeLabel,
  isFoundingUser,
  canAccessFeature,
  PRO_FEATURES,
} from "../src/lib/plan.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

beforeEach(() => {
  applyLaunchStatus({
    foundingCap: 100,
    foundingClaimed: 0,
    betaActive: true,
  });
});

describe("founding launch status", () => {
  it("cap is 100", () => {
    assert.equal(FOUNDING_USER_CAP, 100);
  });

  it("normalizes spots and membership live flag", () => {
    const open = normalizeLaunchStatus({ founding_cap: 100, founding_claimed: 42, beta_active: true });
    assert.equal(open.spotsRemaining, 58);
    assert.equal(open.membershipPaymentsLive, false);

    const closed = normalizeLaunchStatus({ foundingCap: 100, foundingClaimed: 100, betaActive: false });
    assert.equal(closed.spotsRemaining, 0);
    assert.equal(closed.membershipPaymentsLive, true);
  });

  it("hides PayPal checkout while beta open; shows after close", () => {
    assert.equal(isFreeDuringBeta(), true);
    assert.equal(getPlanCheckoutUrl("worker_premium"), null);

    applyLaunchStatus({ foundingCap: 100, foundingClaimed: 100, betaActive: false });
    assert.equal(isBetaActive(), false);
    assert.equal(isMembershipCheckoutLive(), true);
    assert.match(String(getPlanCheckoutUrl("worker_premium") || ""), /paypal\.com/);
  });

  it("founding badge and feature access after beta closes", () => {
    applyLaunchStatus({ foundingCap: 100, foundingClaimed: 100, betaActive: false });
    const founding = { id: "u1", founding_user: true, founding_number: 7, lifetime_premium: true };
    assert.ok(isFoundingUser(founding));
    assert.match(betaBadgeLabel(founding), /Founding #7/);
    assert.equal(canAccessFeature(founding, PRO_FEATURES.driverAddons), true);

    const late = { id: "u2", founding_user: false, plan_tier: "worker_free" };
    assert.equal(canAccessFeature(late, PRO_FEATURES.driverAddons), false);
  });

  it("migration 035 ships claim_founding_slot + platform_launch", () => {
    const path = join(root, "supabase/migrations/035_founding_100_beta.sql");
    assert.ok(existsSync(path));
    const sql = readFileSync(path, "utf8");
    assert.match(sql, /claim_founding_slot/);
    assert.match(sql, /platform_launch/);
    assert.match(sql, /founding_user/);
    assert.match(sql, /founding_cap int NOT NULL DEFAULT 100/);
  });
});
