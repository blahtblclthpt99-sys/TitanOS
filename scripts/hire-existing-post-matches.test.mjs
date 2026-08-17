import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const chooser = fs.readFileSync(new URL("../src/pages/ExistingPostWorkerMatches.jsx", import.meta.url), "utf8");
const stack = fs.readFileSync(new URL("../src/components/layout/TabStack.jsx", import.meta.url), "utf8");
const employerApi = fs.readFileSync(new URL("../src/lib/employerWorkerMatchApi.js", import.meta.url), "utf8");

describe("existing Hire post worker matching", () => {
  it("lists only posts owned by the authenticated employer", () => {
    assert.match(chooser, /\(job\.customer_id \|\| job\.created_by_id\) === user\.id/);
  });

  it("routes selected posts into the owner-scoped candidate matcher", () => {
    assert.match(chooser, /\/hire\/candidates\?job=/);
    assert.match(stack, /"\/hire\/find-workers": ExistingPostWorkerMatches/);
    assert.match(stack, /"\/hire\/candidates": WorkerMatches/);
  });

  it("keeps candidate authorization at the existing job-owner boundary", () => {
    assert.match(employerApi, /Only the job owner can view ranked worker matches/);
    assert.match(employerApi, /listPublishedDrivers/);
    assert.doesNotMatch(employerApi, /job_match_preferences|privacy_prefs|search_lat|search_lng/);
  });
});
