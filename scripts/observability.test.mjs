import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_ANALYTICS_EVENTS,
  trackEvent,
  peekAnalyticsBuffer,
  clearAnalyticsBuffer,
} from "../src/lib/productAnalytics.js";
import {
  DEFAULT_FEATURE_FLAGS,
  hydrateFeatureFlags,
  isFeatureEnabled,
  setLocalFeatureFlag,
  clearLocalFeatureOverrides,
} from "../src/lib/featureFlags.js";
import {
  DEFAULT_OBSERVABILITY_PREFS,
  getObservabilityPrefs,
  setObservabilityPrefs,
  syncObservabilityFromPrivacyPrefs,
} from "../src/lib/observabilityPrefs.js";
import { redactValue, logInfo } from "../api/_lib/safeLog.js";
import { resolveRequestId } from "../api/_lib/requestId.js";
import { isOpsAlertConfigured } from "../api/_lib/opsAlert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

beforeEach(() => {
  localStorage.clear();
  clearAnalyticsBuffer();
  clearLocalFeatureOverrides();
  hydrateFeatureFlags();
  setObservabilityPrefs({ ...DEFAULT_OBSERVABILITY_PREFS });
});

describe("product analytics", () => {
  it("allowlists known events only", () => {
    assert.ok(ALLOWED_ANALYTICS_EVENTS.includes("session_start"));
    assert.equal(trackEvent("not_a_real_event"), false);
    assert.equal(trackEvent("session_start", { email: "x@y.com", plan: "free" }), true);
    const buf = peekAnalyticsBuffer();
    assert.equal(buf.length, 1);
    assert.equal(buf[0].props.email, undefined);
    assert.equal(buf[0].props.plan, "free");
  });

  it("respects product_analytics opt-out", () => {
    setObservabilityPrefs({ product_analytics: false });
    assert.equal(trackEvent("page_view"), false);
    assert.equal(peekAnalyticsBuffer().length, 0);
  });
});

describe("feature flags", () => {
  it("defaults include killable labs + replay off", () => {
    assert.equal(DEFAULT_FEATURE_FLAGS.session_replay, false);
    assert.equal(isFeatureEnabled("ai_assistant"), true);
  });

  it("supports local overrides", () => {
    setLocalFeatureFlag("labs_surfaces", false);
    assert.equal(isFeatureEnabled("labs_surfaces"), false);
    clearLocalFeatureOverrides();
    assert.equal(isFeatureEnabled("labs_surfaces"), true);
  });
});

describe("observability prefs", () => {
  it("session replay defaults off", () => {
    assert.equal(getObservabilityPrefs().session_replay, false);
    syncObservabilityFromPrivacyPrefs({ session_replay: true, product_analytics: false });
    assert.equal(getObservabilityPrefs().session_replay, true);
    assert.equal(getObservabilityPrefs().product_analytics, false);
  });
});

describe("structured logging + request ids", () => {
  it("redacts secrets", () => {
    const out = redactValue({ password: "secret", ok: "yes", token: "abc" });
    assert.equal(out.password, "[redacted]");
    assert.equal(out.token, "[redacted]");
    assert.equal(out.ok, "yes");
  });

  it("resolveRequestId prefers inbound header", () => {
    const id = resolveRequestId({ headers: { "x-request-id": "abc12345-corr" } });
    assert.equal(id, "abc12345-corr");
  });

  it("logInfo emits without throwing", () => {
    assert.doesNotThrow(() => logInfo("test", "hello", { n: 1 }));
  });

  it("ops alert reports configuration state", () => {
    assert.equal(typeof isOpsAlertConfigured(), "boolean");
  });
});

describe("observability surfaces on disk", () => {
  it("migration 033 audit_events exists", () => {
    assert.ok(existsSync(join(root, "supabase/migrations/033_audit_events.sql")));
    const sql = read("supabase/migrations/033_audit_events.sql");
    assert.match(sql, /audit_events/);
    assert.match(sql, /public\.is_admin\(\)/);
    assert.doesNotMatch(sql, /p\.is_admin/);
  });

  it("client sentry wires tracing, vitals, masked replay", () => {
    const src = read("src/lib/sentry.js");
    assert.match(src, /browserTracingIntegration/);
    assert.match(src, /webVitalsIntegration/);
    assert.match(src, /replayIntegration/);
    assert.match(src, /maskAllText:\s*true/);
    assert.match(src, /sendDefaultPii:\s*false/);
  });

  it("health exposes observability readiness", () => {
    const src = read("api/functions/health.js");
    assert.match(src, /opsAlertConfigured/);
    assert.match(src, /observability/);
  });

  it("featureFlags + analyticsIngest API routes exist", () => {
    assert.ok(existsSync(join(root, "api/functions/featureFlags.js")));
    assert.ok(existsSync(join(root, "api/functions/analyticsIngest.js")));
  });
});
