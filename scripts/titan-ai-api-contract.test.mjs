import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTitanAiCapabilities } from "../api/functions/titanAICapabilities.js";
import { loadTitanMemoryContext } from "../api/_lib/titanMemoryContext.js";

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

  it("prioritizes open-loop memory types for forgetting/follow-up questions", async () => {
    const rows = [
      {
        id: "fact-1",
        type: "fact",
        label: "Favorite truck color is blue",
        data: {},
        source: "user_memory",
        confidence: 1,
        created_at: "2026-08-16T00:00:00Z",
        updated_at: "2026-08-16T00:00:00Z",
      },
      {
        id: "workflow-1",
        type: "workflow",
        label: "Follow up with the customer after the estimate",
        data: { status: "open" },
        source: "user_memory",
        confidence: 0.7,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ];
    const query = {
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      async limit() { return { data: rows, error: null }; },
    };
    const admin = { from(name) { assert.equal(name, "titan_memory_nodes"); return query; } };

    const memories = await loadTitanMemoryContext(admin, "user-1", "What am I forgetting or leaving unresolved?");
    assert.equal(memories[0].type, "workflow");
    assert.equal(memories[0].classification, "REMEMBERED");
    assert.equal(memories.length, 2);
  });
});
