import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dispatchNativeApi, hasNativeApiRoute } from "../cloudflare/api-router.js";

const ROUTE = "/api/functions/titanAICapabilities";
const URL = `https://preview.titanos.invalid${ROUTE}`;

async function dispatch(method = "GET") {
  return dispatchNativeApi(
    new Request(URL, {
      method,
      headers: {
        Origin: "https://titanos.app",
        "X-Request-Id": "capabilities-contract-test",
      },
    }),
    "capabilities-contract-test",
  );
}

describe("Cloudflare TitanAI capabilities candidate", () => {
  it("is explicitly registered as a native Worker route", () => {
    assert.equal(hasNativeApiRoute(ROUTE), true);
  });

  it("returns a truthful, non-mutating integration contract through the Worker adapter", async () => {
    const response = await dispatch("GET");

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-titanos-api-runtime"), "cloudflare-workers-native");
    assert.match(response.headers.get("cache-control") || "", /no-store/i);

    const body = await response.json();
    assert.equal(body.service, "Titan AI");
    assert.equal(body.platform, "TitanOS");
    assert.equal(body.version, 1);

    assert.deepEqual(
      {
        method: body.endpoints?.titanAICapabilities?.method,
        path: body.endpoints?.titanAICapabilities?.path,
        authRequired: body.endpoints?.titanAICapabilities?.authRequired,
      },
      {
        method: "GET",
        path: ROUTE,
        authRequired: false,
      },
    );

    assert.equal(body.endpoints?.titanAI?.method, "POST");
    assert.equal(body.endpoints?.titanAI?.authRequired, true);
    assert.equal(body.endpoints?.aiExecuteAction?.method, "POST");
    assert.equal(body.endpoints?.aiExecuteAction?.authRequired, true);

    assert.ok(Array.isArray(body.supportedIntents));
    assert.ok(body.supportedIntents.length > 0);
    const intentIds = body.supportedIntents.map((intent) => intent.id);
    assert.equal(new Set(intentIds).size, intentIds.length);

    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|OPENAI_API_KEY|SENTRY_AUTH_TOKEN/i);
  });

  it("rejects mutating methods", async () => {
    const response = await dispatch("POST");
    assert.equal(response.status, 405);
    const body = await response.json();
    assert.equal(body.error, "Method not allowed");
  });

  it("accepts HEAD without invoking an AI provider or database", async () => {
    const response = await dispatch("HEAD");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-titanos-api-runtime"), "cloudflare-workers-native");
  });
});
