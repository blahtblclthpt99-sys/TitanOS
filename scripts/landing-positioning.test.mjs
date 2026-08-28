import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const landing = readFileSync(new URL("../src/pages/Landing.jsx", import.meta.url), "utf8");

describe("TitanOS landing positioning", () => {
  it("centers the platform on work, careers, independent work, and business", () => {
    assert.match(landing, /Find work\. Run work\. Grow work\./);
    assert.match(landing, /Job Seekers/);
    assert.match(landing, /Independent Work/);
    assert.match(landing, /Business/);
    assert.match(landing, /Three workspaces\. One operating system\./);
    assert.match(landing, /Work operating system/);
  });

  it("keeps Driver Hub as a field\/business capability instead of the whole product identity", () => {
    assert.match(landing, /Fleet, Driver Hub & field tools/);
    assert.match(landing, /Business field operations can use Driver Hub/);
    assert.doesNotMatch(landing, /The operating system for the road\./);
    assert.doesNotMatch(landing, /Driver OS for the Road/);
  });

  it("does not publish unsupported social proof or earnings promises", () => {
    assert.doesNotMatch(landing, /REVIEWS/);
    assert.doesNotMatch(landing, /early users are saying/i);
    assert.doesNotMatch(landing, /at least 10% more/i);
    assert.doesNotMatch(landing, /paid for itself/i);
    assert.doesNotMatch(landing, /game changer/i);
  });

  it("does not hard-code payment readiness or contradictory beta pricing on the homepage", () => {
    assert.doesNotMatch(landing, /\$4\.99/);
    assert.doesNotMatch(landing, /\$0/);
    assert.doesNotMatch(landing, /during beta/i);
    assert.doesNotMatch(landing, /Secure checkout/i);
    assert.doesNotMatch(landing, /Powered by Stripe/i);
    assert.match(landing, /Current plans and availability are shown on the pricing page\./);
    assert.match(landing, /to="\/pricing"/);
  });

  it("preserves accessibility and authenticated-session routing safeguards", () => {
    assert.match(landing, /Skip to content/);
    assert.match(landing, /aria-label="Primary"/);
    assert.match(landing, /aria-expanded=\{menuOpen\}/);
    assert.match(landing, /hasCachedAuthSession\(\)/);
    assert.match(landing, /<Spinner fullScreen label="Loading TitanOS"/);
  });
});
