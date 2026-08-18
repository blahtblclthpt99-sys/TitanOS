import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

describe("TitanfieldOS Cloudflare hosting contract", () => {
  const wrangler = read("wrangler.jsonc");
  const redirects = read("public/_redirects");
  const headers = read("public/_headers");
  const adapter = read("functions/_lib/vercelAdapter.js");
  const router = read("functions/api/functions/[name].js");
  const mppBoundary = read("functions/api/functions/mppPaid.js");
  const register = read("functions/api/register.js");
  const serverTelemetry = read("api/_lib/sentry.js");

  it("builds Vite output as a node-compatible Cloudflare Pages project", () => {
    assert.match(wrangler, /"pages_build_output_dir"\s*:\s*"\.\/dist"/);
    assert.match(wrangler, /"nodejs_compat"/);
    assert.match(wrangler, /"compatibility_date"\s*:\s*"2026-08-18"/);
  });

  it("keeps React routes on the SPA and preserves the Titan AI compatibility alias", () => {
    assert.match(redirects, /\/\* \/index\.html 200/);
    assert.match(router, /titanAI:\s*\(\) => import\("\.\.\/\.\.\/\.\.\/api\/functions\/titanAILive\.js"\)/);
  });

  it("preserves request identity, query, JSON and raw webhook bytes", () => {
    assert.match(adapter, /cf-connecting-ip/);
    assert.match(adapter, /query:\s*queryObject\(url\)/);
    assert.match(adapter, /rawBody/);
    assert.match(adapter, /request\.arrayBuffer\(\)/);
    assert.match(adapter, /Symbol\.asyncIterator/);
  });

  it("preserves production security semantics instead of relying on Vercel runtime injection", () => {
    assert.match(adapter, /process\.env\.NODE_ENV = "production"/);
    assert.match(adapter, /process\.env\.VERCEL_ENV = "production"/);
    assert.match(adapter, /https:\/\/titanfieldos\.com/);
  });

  it("keeps shared server telemetry Worker-safe instead of bundling the Node Sentry SDK", () => {
    assert.match(serverTelemetry, /application\/x-sentry-envelope/);
    assert.match(serverTelemetry, /captureApiException/);
    assert.doesNotMatch(serverTelemetry, /@sentry\/node|@sentry\/profiling-node|\.\.\/instrument\.mjs/);
  });

  it("ports registration and all current core work-system APIs to same-origin Pages Functions", () => {
    assert.match(register, /api\/register\.js/);
    for (const name of [
      "jobMatchesV2",
      "workOpportunities",
      "recordOpportunityResponse",
      "setWorkspaces",
      "leadDiscovery",
      "titanAILive",
      "aiExecuteAction",
      "engagementSnapshot",
      "engagementBatch",
      "disputeEngagementEvent",
      "createPaymentLink",
      "createSubscriptionCheckout",
      "stripeCustomerPortal",
      "stripeWebhook",
      "runAutopilotOrder",
      "runAutopilotMembership",
      "health",
    ]) {
      assert.match(router, new RegExp(`\\b${name}:`), `${name} must be routed on Cloudflare`);
    }
  });

  it("quarantines only the experimental MPP route from the core Worker", () => {
    assert.doesNotMatch(router, /\bmppPaid:/);
    assert.match(mppBoundary, /mpp_worker_unavailable/);
    assert.match(mppBoundary, /alternative:\s*"standard_stripe"/);
    assert.match(mppBoundary, /status:\s*503/);
    assert.doesNotMatch(mppBoundary, /mppx|mpp-sdk/);
  });

  it("moves the public security policy to TitanfieldOS without making Vercel a runtime dependency", () => {
    assert.match(headers, /https:\/\/titanfieldos\.com/);
    assert.match(headers, /https:\/\/www\.titanfieldos\.com/);
    assert.doesNotMatch(headers, /titanos-web\.vercel\.app/);
    assert.match(headers, /Strict-Transport-Security/);
    assert.match(headers, /Content-Security-Policy/);
  });
});
