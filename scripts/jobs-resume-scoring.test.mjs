import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/lib/jobMatchApi.js", import.meta.url), "utf8");
const start = source.indexOf("export function rankNativePosting");
const end = source.indexOf("async function nativeFallback", start);
assert.ok(start >= 0 && end > start);
const enrich = runInNewContext(source.slice(start, end).replaceAll("export function ", "function ") +
  "\nenrichUnrankedWithResume;", {});

test("device résumé ranks native openings without replacing server match scores", () => {
  const data = { needsSkills: true, matches: [
    { id: "one", title: "Forklift Operator", description: "Forklift warehouse", match: { score: null, source: "titan" }, interaction_state: "saved" },
    { id: "two", title: "Bookkeeper", description: "Accounting", match: { score: null, source: "titan" } },
    { id: "three", title: "External driver", source: "external", match: { score: null, source: "external" } },
    { id: "four", title: "Warehouse lead", match: { score: 75, source: "titan", score_method: "server_rank" } },
  ] };
  const result = enrich(data, { skills: ["forklift"], target: "forklift operator" });
  assert.equal(result.needsSkills, false);
  assert.equal(result.matches[0].id, "one");
  assert.equal(result.matches[0].match.score, 100);
  assert.equal(result.matches[0].interaction_state, "saved");
  assert.equal(result.matches.find((job) => job.id === "three").match.score, null);
  assert.equal(result.matches.find((job) => job.id === "four").match.score, 75);
  assert.equal(result.matches.find((job) => job.id === "four").match.score_method, "server_rank");
  assert.equal(result.localResumeScoring, "keyword_overlap_only");
});

test("without saved résumé, existing server result is unchanged", () => {
  const data = { needsSkills: true, matches: [{ id: "one", match: { score: null } }] };
  assert.equal(enrich(data, { skills: [], target: "" }), data);
});
