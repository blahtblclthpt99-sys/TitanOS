import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmedActionErrorMessage,
  rollbackMessage,
  shouldRetainRollback,
} from "../src/lib/secondMeActionUi.js";
import {
  isBroadMemoryQuestion,
  memoryBasisSummary,
  selectRelevantTitanMemories,
} from "../api/_lib/titanMemoryContext.js";

describe("2nd Me action UI integrity", () => {
  it("retains rollback metadata when rollback fails", () => {
    assert.equal(shouldRetainRollback({ type: "error" }), true);
    assert.match(rollbackMessage("Action completed.", { type: "error", message: "Temporary failure" }), /Rollback failed: Temporary failure/);
  });

  it("clears rollback metadata only after success", () => {
    assert.equal(shouldRetainRollback({ type: "done" }), false);
    assert.match(rollbackMessage("Action completed.", { type: "done", message: "Removed safely" }), /Rollback: Removed safely/);
  });

  it("surfaces permission and throttling errors precisely", () => {
    assert.match(confirmedActionErrorMessage({ status: 403 }), /does not have permission/i);
    assert.match(confirmedActionErrorMessage({ status: 429 }), /too many requests/i);
  });
});

describe("2nd Me selective memory context", () => {
  const memories = [
    { id: "1", type: "vehicle", label: "Ford Ranger needs an oil change", data: {}, source: "user_memory", confidence: 0.9, updatedAt: new Date().toISOString() },
    { id: "2", type: "project", label: "Kitchen remodel budget", data: {}, source: "conversation", confidence: 0.95, updatedAt: new Date().toISOString() },
  ];

  it("does not inject unrelated memories into a specific question", () => {
    const selected = selectRelevantTitanMemories(memories, "When does my Ford Ranger need an oil change?");
    assert.equal(selected.length, 1);
    assert.equal(selected[0].id, "1");
  });

  it("allows bounded broad retrieval for open-loop questions", () => {
    assert.equal(isBroadMemoryQuestion("What am I forgetting?"), true);
    const selected = selectRelevantTitanMemories(memories, "What am I forgetting?");
    assert.equal(selected.length, 2);
  });

  it("summarizes memory provenance without returning memory text", () => {
    assert.deepEqual(memoryBasisSummary(memories), { count: 2, sources: ["user_memory", "conversation"] });
  });
});
