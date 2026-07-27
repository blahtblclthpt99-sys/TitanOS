/**
 * Shared entitlement fortress (pure).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FEATURES,
  profileAllowsFeature,
  isFoundingTrialActive,
  resolvePlanId,
} from "../shared/entitlements.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("shared entitlements", () => {
  it("free plan cannot use AI or marketplace apps", () => {
    const free = { plan_tier: "worker_free", role: "user" };
    assert.equal(profileAllowsFeature(free, FEATURES.aiAssistant), false);
    assert.equal(profileAllowsFeature(free, FEATURES.marketplaceApps), false);
    assert.equal(profileAllowsFeature(free, FEATURES.ocrReceipts), false);
    assert.equal(profileAllowsFeature(free, FEATURES.routeOptimization), false);
  });

  it("starter unlocks estimates but not AI", () => {
    const starter = { plan_tier: "starter", role: "user" };
    assert.equal(resolvePlanId(starter), "starter");
    assert.equal(profileAllowsFeature(starter, FEATURES.unlimitedEstimates), true);
    assert.equal(profileAllowsFeature(starter, FEATURES.aiAssistant), false);
    assert.equal(profileAllowsFeature(starter, FEATURES.driverAddons), false);
  });

  it("pro unlocks AI apps OCR routes", () => {
    const pro = { plan_tier: "worker_premium", role: "user" };
    assert.equal(profileAllowsFeature(pro, FEATURES.aiAssistant), true);
    assert.equal(profileAllowsFeature(pro, FEATURES.marketplaceApps), true);
    assert.equal(profileAllowsFeature(pro, FEATURES.ocrReceipts), true);
  });

  it("founding trial unlocks pro; expired trial does not", () => {
    const trial = {
      founding_user: true,
      founding_trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
      founding_locked_plan: "worker_premium",
      plan_tier: "worker_premium",
    };
    assert.ok(isFoundingTrialActive(trial));
    assert.equal(profileAllowsFeature(trial, FEATURES.aiAssistant), true);

    const expired = {
      founding_user: true,
      founding_trial_ends_at: new Date(Date.now() - 86400000).toISOString(),
      founding_locked_plan: "worker_premium",
      plan_tier: "worker_free",
      paying_subscriber: false,
      lifetime_premium: false,
    };
    assert.equal(isFoundingTrialActive(expired), false);
    assert.equal(profileAllowsFeature(expired, FEATURES.aiAssistant), false);
  });

  it("admin always allowed", () => {
    assert.equal(profileAllowsFeature({ role: "admin", plan_tier: "worker_free" }, FEATURES.aiAssistant), true);
  });
});

describe("server entitlement wiring", () => {
  it("api/_lib/entitlements.js and installMarketplaceModule exist", () => {
    assert.ok(existsSync(join(root, "api/_lib/entitlements.js")));
    assert.ok(existsSync(join(root, "api/functions/installMarketplaceModule.js")));
    assert.ok(existsSync(join(root, "shared/entitlements.js")));
  });

  it("premium cost routes call requireFeature", () => {
    const titan = readFileSync(join(root, "api/functions/titanAI.js"), "utf8");
    const ocr = readFileSync(join(root, "api/functions/receiptVisionOcr.js"), "utf8");
    const dirs = readFileSync(join(root, "api/functions/directionsOptimize.js"), "utf8");
    const aiExec = readFileSync(join(root, "api/functions/aiExecuteAction.js"), "utf8");
    const install = readFileSync(join(root, "api/functions/installMarketplaceModule.js"), "utf8");
    for (const src of [titan, ocr, dirs, aiExec, install]) {
      assert.match(src, /requireFeature/);
    }
    assert.match(titan, /FEATURES\.aiAssistant/);
    assert.match(ocr, /FEATURES\.ocrReceipts/);
    assert.match(dirs, /FEATURES\.routeOptimization/);
    assert.match(install, /FEATURES\.marketplaceApps/);
  });
});
