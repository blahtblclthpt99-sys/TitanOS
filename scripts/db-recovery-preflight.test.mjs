import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyRecoveryState } from "./db-recovery-preflight.mjs";

const rows = (names, exists = true) => names.map((table) => ({ table, exists }));

describe("TitanOS database recovery preflight classification", () => {
  it("allows mutation probes only when TitanOS core and support tables are present", () => {
    const result = classifyRecoveryState({
      required: rows(["profiles", "jobs"]),
      support: rows(["support_cases", "support_messages"]),
      attention: rows(["attention_profiles"], false),
    });

    assert.equal(result.state, "TITANOS_CORE_PRESENT");
    assert.equal(result.safeForMutationProbes, true);
    assert.deepEqual(result.requiredMissing, []);
  });

  it("identifies a fully purged/replaced TitanOS schema", () => {
    const result = classifyRecoveryState({
      required: rows(["profiles", "jobs"], false),
      support: rows(["support_cases"], false),
      attention: rows(["attention_profiles", "attention_campaigns"]),
    });

    assert.equal(result.state, "PURGED_OR_REPLACED");
    assert.equal(result.safeForMutationProbes, false);
    assert.deepEqual(result.requiredMissing, ["profiles", "jobs"]);
  });

  it("fails closed for a partial TitanOS reconstruction", () => {
    const result = classifyRecoveryState({
      required: [
        { table: "profiles", exists: true },
        { table: "jobs", exists: false },
      ],
      support: rows(["support_cases"], false),
      attention: [],
    });

    assert.equal(result.state, "INCOMPLETE_OR_PARTIAL_TITANOS");
    assert.equal(result.safeForMutationProbes, false);
  });

  it("reports a mixed schema and still requires Support before mutation probes", () => {
    const result = classifyRecoveryState({
      required: rows(["profiles", "jobs"]),
      support: [{ table: "support_cases", exists: false }],
      attention: rows(["attention_profiles"]),
    });

    assert.equal(result.state, "MIXED_TITANOS_AND_ATTENTION");
    assert.equal(result.safeForMutationProbes, false);
    assert.deepEqual(result.supportMissing, ["support_cases"]);
    assert.deepEqual(result.attentionPresent, ["attention_profiles"]);
  });
});
