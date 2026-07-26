import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_AI_INTENTS,
  isAllowedAiIntent,
  listAllowedIntentIds,
} from "../api/_lib/aiIntents.js";

describe("AI workflow allowlist", () => {
  it("exposes approved intents only", () => {
    const ids = listAllowedIntentIds();
    assert.ok(ids.includes("schedule_job"));
    assert.ok(ids.includes("create_invoice"));
    assert.ok(ids.includes("send_invoice"));
    assert.ok(!ids.includes("delete_account"));
    assert.ok(!ids.includes("refund_payment"));
  });

  it("isAllowedAiIntent gates unknown intents", () => {
    assert.equal(isAllowedAiIntent("create_estimate"), true);
    assert.equal(isAllowedAiIntent("drop_database"), false);
    assert.equal(isAllowedAiIntent(""), false);
    assert.equal(isAllowedAiIntent(null), false);
  });

  it("send_invoice honesty documents no email side effect", () => {
    const meta = ALLOWED_AI_INTENTS.send_invoice;
    assert.match(meta.description, /sent/i);
    assert.ok(meta.honesty);
    assert.match(meta.honesty, /email/i);
  });

  it("every intent has label, path, description", () => {
    for (const [id, meta] of Object.entries(ALLOWED_AI_INTENTS)) {
      assert.ok(meta.label, id);
      assert.ok(meta.path?.startsWith("/"), id);
      assert.ok(meta.description, id);
    }
  });
});
