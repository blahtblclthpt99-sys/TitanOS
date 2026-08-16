import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actionPayloadHash, normalizeActionId } from "../api/_lib/actionIdempotency.js";
import { ensureSecondMeActionId } from "../src/lib/secondMeActionId.js";

describe("2nd Me action idempotency", () => {
  it("uses a stable payload hash regardless of object key order", () => {
    const a = actionPayloadHash("create_invoice", { total: 125, customer_name: "Acme" });
    const b = actionPayloadHash("create_invoice", { customer_name: "Acme", total: 125 });
    assert.equal(a, b);
    assert.notEqual(a, actionPayloadHash("create_invoice", { customer_name: "Acme", total: 126 }));
  });

  it("rejects malformed or too-short action ids", () => {
    assert.throws(() => normalizeActionId("bad"), /invalid/i);
    assert.equal(normalizeActionId("ai:12345678"), "ai:12345678");
  });

  it("preserves an existing confirmation action id across retries", () => {
    const id = ensureSecondMeActionId({ actionId: "ai:stable-retry-123" });
    assert.equal(id, "ai:stable-retry-123");
  });
});
