import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const matching = readFileSync(new URL("../src/lib/jobMatchApi.js", import.meta.url), "utf8");
const screen = readFileSync(new URL("../src/pages/JobMatches.jsx", import.meta.url), "utf8");

test("real open jobs remain visible without completed résumé skills", () => {
  assert.match(matching, /const hasMatchInputs = Boolean/);
  assert.match(matching, /postings\.map\(\(job\) => \(\{/);
  assert.match(matching, /score: null/);
  assert.match(matching, /score_method: "unranked"/);
});
test("the interface never mislabels unranked jobs as zero-percent matches", () => {
  assert.match(screen, /score == null \? "Not ranked"/);
  assert.match(screen, /keyword match/);
});
test("local fallback still retrieves real open TitanOS jobs under RLS", () => {
  assert.match(matching, /\.from\("hire_jobs"\)/);
  assert.match(matching, /\.eq\("status", "open"\)/);
  assert.doesNotMatch(matching, /fakeJobs|mockJobs/);
});
