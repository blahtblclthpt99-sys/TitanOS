import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeCompensatingWorkflow } from "../api/_lib/compensatingWorkflow.js";

describe("2nd Me compensating workflow", () => {
  it("rolls back completed steps in reverse order when a later step fails", async () => {
    const events = [];
    const steps = [
      { intent: "one" },
      { intent: "two" },
      { intent: "three" },
    ];

    await assert.rejects(
      () => executeCompensatingWorkflow({
        steps,
        executeStep: async (step, index) => {
          events.push(`execute:${step.intent}`);
          if (index === 2) throw new Error("step three failed");
          return { rollback: { id: step.intent } };
        },
        rollbackStep: async (rollback) => {
          events.push(`rollback:${rollback.id}`);
        },
      }),
      (error) => {
        assert.equal(error.compensated, true);
        assert.equal(error.completedSteps, 2);
        assert.match(error.message, /rolled back safely/i);
        return true;
      }
    );

    assert.deepEqual(events, [
      "execute:one",
      "execute:two",
      "execute:three",
      "rollback:two",
      "rollback:one",
    ]);
  });

  it("flags incomplete compensation for manual review", async () => {
    await assert.rejects(
      () => executeCompensatingWorkflow({
        steps: [{ intent: "one" }, { intent: "two" }],
        executeStep: async (step, index) => {
          if (index === 1) throw new Error("second failed");
          return { rollback: { id: step.intent } };
        },
        rollbackStep: async () => {
          throw new Error("rollback failed");
        },
      }),
      (error) => {
        assert.equal(error.compensated, false);
        assert.equal(error.rollbackFailures.length, 1);
        assert.match(error.message, /manual review is required/i);
        return true;
      }
    );
  });
});
