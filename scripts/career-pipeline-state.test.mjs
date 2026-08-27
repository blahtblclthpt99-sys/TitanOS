import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCareerStateTransition,
  availableCareerStageTransitions,
  canTransitionCareerState,
} from "../src/lib/careerPipelineState.js";

test("allows new tracking records and idempotent stage writes", () => {
  assert.equal(canTransitionCareerState(null, "saved"), true);
  assert.equal(canTransitionCareerState("applied", "applied"), true);
});

test("allows forward progress and skipped hiring stages", () => {
  assert.equal(canTransitionCareerState("saved", "applied"), true);
  assert.equal(canTransitionCareerState("applied", "interview"), true);
  assert.equal(canTransitionCareerState("screening", "offer"), true);
  assert.equal(canTransitionCareerState("offer", "hired"), true);
});

test("rejects backward application regressions", () => {
  assert.equal(canTransitionCareerState("interview", "applied"), false);
  assert.equal(canTransitionCareerState("hired", "offer"), false);
  assert.equal(canTransitionCareerState("closed", "saved"), false);
  assert.throws(() => assertCareerStateTransition("interview", "saved"), /cannot move backward/i);
});

test("keeps ignored opportunities outside the application pipeline", () => {
  assert.equal(canTransitionCareerState("saved", "ignored"), true);
  assert.equal(canTransitionCareerState("applied", "ignored"), false);
  assert.equal(canTransitionCareerState("ignored", "saved"), true);
  assert.equal(canTransitionCareerState("ignored", "applied"), true);
});

test("final stages expose no forward stage choices", () => {
  assert.deepEqual(availableCareerStageTransitions("closed"), ["closed"]);
  assert.deepEqual(availableCareerStageTransitions("offer"), ["offer", "hired", "closed"]);
});
