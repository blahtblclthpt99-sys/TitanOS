import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { careerStorageKey } from "../src/lib/careerPreferenceStorage.js";

describe("career preference storage isolation", () => {
  it("uses a different storage namespace for each signed-in user", () => {
    const first = careerStorageKey("user-a", "job-alerts");
    const second = careerStorageKey("user-b", "job-alerts");
    assert.notEqual(first, second);
    assert.match(first, /user-a/);
    assert.match(second, /user-b/);
  });

  it("normalizes preference names without collapsing account identity", () => {
    assert.equal(
      careerStorageKey("user-a", "Reviewed Alert Matches"),
      "titanos_career_v1:user-a:reviewed-alert-matches"
    );
  });
});
