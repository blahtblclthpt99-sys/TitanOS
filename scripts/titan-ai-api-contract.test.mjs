import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTitanAiCapabilities } from "../api/functions/titanAICapabilities.js";

describe("Titan AI API contract", () => {
  it("publishes the external Titan AI routes and Base44 integration guidance", () => {
    const contract = buildTitanAiCapabilities();

    assert.equal(contract.integration.auth.issuer, "Supabase Auth");
    assert.equal(contract.integration.browserCors.configureWithEnv, "CORS_ALLOWED_ORIGINS");
    assert.equal(contract.endpoints.titanAI.path, "/api/functions/titanAI");
    assert.equal(contract.endpoints.aiExecuteAction.path, "/api/functions/aiExecuteAction");
    assert.ok(contract.supportedIntents.some((intent) => intent.id === "create_invoice"));
    assert.ok(contract.workflows.includes("morning_ops"));
  });
});