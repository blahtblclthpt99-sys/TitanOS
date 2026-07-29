import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectConfirmIntent } from "../api/functions/titanAI.js";

describe("Titan AI workflows", () => {
  it("detects morning ops workflow", () => {
    const cmd = detectConfirmIntent("run morning ops workflow");
    assert.equal(cmd.intent, "run_workflow");
    assert.equal(cmd.params.workflowId, "morning_ops");
    assert.ok(Array.isArray(cmd.params.steps));
    assert.ok(cmd.params.steps.length >= 3);
  });

  it("detects cash recovery workflow", () => {
    const cmd = detectConfirmIntent("run cash recovery sprint");
    assert.equal(cmd.intent, "run_workflow");
    assert.equal(cmd.params.workflowId, "cash_recovery");
    assert.ok(cmd.params.steps.some((step) => step.intent === "send_invoice"));
  });

  it("detects daily closeout workflow", () => {
    const cmd = detectConfirmIntent("run daily closeout workflow");
    assert.equal(cmd.intent, "run_workflow");
    assert.equal(cmd.params.workflowId, "closeout");
    assert.ok(cmd.params.steps.some((step) => step.intent === "record_expense"));
  });

  it("returns clarify when expense amount missing", () => {
    const cmd = detectConfirmIntent("record expense for fuel");
    assert.equal(cmd.type, "clarify");
    assert.match(cmd.message, /need an amount/i);
  });
});
