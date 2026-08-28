import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  normalizeFeatureFlags,
  normalizeLaunchRecord,
  safeLaunchFallback,
} from "../api/functions/featureFlags.js";
import { dispatchNativeApi, hasNativeApiRoute } from "../cloudflare/api-router.js";

const ROUTE = "/api/functions/featureFlags";
const URL = `https://preview.titanos.invalid${ROUTE}`;
const ENV_KEYS = ["FEATURE_FLAGS_JSON", "VITE_FEATURE_FLAGS_JSON", "MEMBERSHIP_PAYMENTS_LIVE"];
const original = new Map();

function setEnv(name, value) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}

async function dispatch(method = "GET") {
  return dispatchNativeApi(
    new Request(URL, {
      method,
      headers: {
        Origin: "https://titanos.app",
        "X-Request-Id": "feature-flags-contract-test",
      },
    }),
    "feature-flags-contract-test",
  );
}

beforeEach(() => {
  for (const key of ENV_KEYS) original.set(key, process.env[key]);
});

afterEach(() => {
  for (const key of ENV_KEYS) setEnv(key, original.get(key));
  original.clear();
});

describe("feature flag configuration normalization", () => {
  it("accepts only known boolean overrides", () => {
    const flags = normalizeFeatureFlags(
      JSON.stringify({
        referrals: true,
        session_replay: true,
        ai_assistant: false,
        unknown_flag: true,
        driver_autopilot: "false",
      }),
    );

    assert.equal(flags.referrals, true);
    assert.equal(flags.session_replay, true);
    assert.equal(flags.ai_assistant, false);
    assert.equal(flags.driver_autopilot, true);
    assert.equal("unknown_flag" in flags, false);
  });

  it("ignores malformed or non-object configuration", () => {
    const malformed = normalizeFeatureFlags("{bad-json");
    const array = normalizeFeatureFlags("[]");
    const scalar = normalizeFeatureFlags("true");

    assert.equal(malformed.referrals, false);
    assert.equal(array.referrals, false);
    assert.equal(scalar.referrals, false);
  });
});

describe("platform_launch integrity normalization", () => {
  it("normalizes a valid row and closes beta when capacity is exhausted", () => {
    assert.deepEqual(
      normalizeLaunchRecord(
        { founding_cap: 100, founding_claimed: 99, beta_active: true },
        { membershipPaymentsLive: true },
      ),
      {
        foundingCap: 100,
        foundingClaimed: 99,
        spotsRemaining: 1,
        betaActive: true,
        membershipPaymentsLive: true,
        verified: true,
        source: "platform_launch",
      },
    );

    const full = normalizeLaunchRecord(
      { founding_cap: 100, founding_claimed: 100, beta_active: true },
      { membershipPaymentsLive: true },
    );
    assert.equal(full.betaActive, false);
    assert.equal(full.spotsRemaining, 0);
  });

  it("rejects invalid, negative, fractional, over-cap, and incomplete rows", () => {
    const invalidRows = [
      null,
      [],
      {},
      { founding_cap: 0, founding_claimed: 0, beta_active: true },
      { founding_cap: -1, founding_claimed: 0, beta_active: true },
      { founding_cap: 1_000_001, founding_claimed: 0, beta_active: true },
      { founding_cap: 100.5, founding_claimed: 0, beta_active: true },
      { founding_cap: 100, founding_claimed: -1, beta_active: true },
      { founding_cap: 100, founding_claimed: 101, beta_active: true },
      { founding_cap: 100, founding_claimed: 1.5, beta_active: true },
      { founding_cap: "garbage", founding_claimed: 1, beta_active: true },
      { founding_cap: 100, founding_claimed: "garbage", beta_active: true },
      { founding_cap: 100, founding_claimed: 1, beta_active: "true" },
    ];

    for (const row of invalidRows) {
      assert.equal(normalizeLaunchRecord(row, { membershipPaymentsLive: true }), null);
    }
  });

  it("never enables payments in the unverified fallback", () => {
    assert.deepEqual(safeLaunchFallback(), {
      foundingCap: 100,
      foundingClaimed: 0,
      spotsRemaining: 100,
      betaActive: true,
      membershipPaymentsLive: false,
      verified: false,
      source: "safe_fallback",
    });
  });
});

describe("Cloudflare featureFlags route", () => {
  it("is registered and rejects mutating methods", async () => {
    assert.equal(hasNativeApiRoute(ROUTE), true);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await dispatch(method);
      assert.equal(response.status, 405, `${method} must be rejected`);
      const body = await response.json();
      assert.equal(body.error, "Method not allowed");
    }
  });

  it("fails payment readiness closed when integration configuration is unavailable", async () => {
    setEnv("FEATURE_FLAGS_JSON", JSON.stringify({ referrals: true }));
    setEnv("VITE_FEATURE_FLAGS_JSON", null);
    setEnv("MEMBERSHIP_PAYMENTS_LIVE", "true");

    const response = await dispatch("GET");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-titanos-api-runtime"), "cloudflare-workers-native");
    assert.match(response.headers.get("cache-control") || "", /no-store/i);

    const body = await response.json();
    assert.equal(body.flags.referrals, true);
    assert.equal(body.launch.verified, false);
    assert.equal(body.launch.source, "safe_fallback");
    assert.equal(body.launch.membershipPaymentsLive, false);
    assert.match(body.ts, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("accepts HEAD", async () => {
    const response = await dispatch("HEAD");
    assert.equal(response.status, 200);
  });
});
