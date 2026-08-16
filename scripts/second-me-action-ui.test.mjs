import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmedActionErrorMessage,
  rollbackMessage,
  shouldRetainRollback,
} from "../src/lib/secondMeActionUi.js";

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
