import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

describe("TitanOS ad monetization boundary", () => {
  const policy = read("src/lib/ads.js");
  const placement = read("src/components/monetization/AdPlacement.jsx");
  const layout = read("src/components/layout/AppLayout.jsx");
  const privacy = read("src/pages/PrivacyPolicy.jsx");
  const csp = read("vercel.json");

  it("limits ads to the four approved free-tier web surfaces", () => {
    for (const path of ["/", "/hire/matches", "/independent", "/work-opportunities"]) {
      assert.match(policy, new RegExp(`\\"${path.replaceAll("/", "\\/")}\\"`));
    }
    for (const blocked of [
      "/payments",
      "/invoices",
      "/estimates",
      "/talent",
      "/hire/candidates",
      "/job-profile",
      "/service-profile",
      "/driver",
      "/fleet",
      "/support",
      "/admin",
      "/autopilot",
    ]) {
      assert.doesNotMatch(policy, new RegExp(`\\"${blocked.replaceAll("/", "\\/")}\\"\\s*:`));
    }
  });

  it("uses billing entitlement rather than workspace identity and keeps paid users ad-free", () => {
    assert.match(policy, /resolvePlan\(user\)/);
    assert.match(policy, /worker_free/);
    assert.match(policy, /customer/);
    assert.doesNotMatch(policy, /starter[^\n]*AD_SUPPORTED_PLANS/);
    assert.doesNotMatch(policy, /worker_premium[^\n]*AD_SUPPORTED_PLANS/);
    assert.doesNotMatch(policy, /business[^\n]*AD_SUPPORTED_PLANS/);
  });

  it("suppresses web ads in native Capacitor and labels sponsored inventory", () => {
    assert.match(placement, /Capacitor\.isNativePlatform\(\)/);
    assert.match(policy, /if \(isNative/);
    assert.match(placement, /aria-label="Sponsored"/);
    assert.match(placement, />\s*Sponsored\s*</);
  });

  it("fails closed when the publisher client, slot, or enable flag is absent", () => {
    assert.match(policy, /ADSENSE_ENABLED/);
    assert.match(policy, /ADSENSE_CLIENT/);
    assert.match(policy, /if \(!placement \|\| !getAdSlot\(placement\)\) return false/);
    assert.match(placement, /if \(!eligible\) return null/);
  });

  it("places the provider outside page business logic and preserves support isolation", () => {
    assert.match(layout, /<AdPlacement key=\{pathname\} \/>/);
    assert.match(layout, /!isSupportCenter && !isSupportCommandCenter/);
  });

  it("documents advertising privacy and CSP endpoints", () => {
    assert.match(privacy, /title: "Advertising"/);
    assert.match(privacy, /Paid subscription tiers are intended to remain ad-free/);
    assert.match(csp, /pagead2\.googlesyndication\.com/);
    assert.match(csp, /fundingchoicesmessages\.google\.com/);
  });
});
