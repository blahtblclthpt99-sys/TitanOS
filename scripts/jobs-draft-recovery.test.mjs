import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("../src/lib/jobMatchApi.js", import.meta.url), "utf8");
const start = source.indexOf("function safeLocalJson(");
const end = source.indexOf("\nexport function rankNativePosting", start);
assert.ok(start !== -1 && end > start, "matching storage helpers present");

function getProfile(records) {
  const localStorage = { getItem: (key) => records[key] ?? null };
  const context = runInNewContext(source.slice(start, end) + "\nsavedResumeSkills", { localStorage, JSON, Set });
  return context("test-user");
}
test("malformed résumé does not erase valid job preferences", () => {
  const profile = getProfile({
    "titanos:resume:v1:test-user": "{invalid",
    "titanos:jobprefs:v1:test-user": JSON.stringify({ skills: "Welding, Customer service", interests: "Warehouse Associate" }),
  });
  assert.deepEqual(Array.from(profile.skills), ["welding", "customer service"]);
  assert.equal(profile.target, "warehouse associate");
});
test("malformed preferences do not erase résumé qualifications", () => {
  const profile = getProfile({
    "titanos:resume:v1:test-user": JSON.stringify({ skills: "Route planning, Delivery", headline: "Courier" }),
    "titanos:jobprefs:v1:test-user": "{invalid",
  });
  assert.deepEqual(Array.from(profile.skills), ["route planning", "delivery"]);
  assert.equal(profile.target, "courier");
});
test("missing drafts do not invent worker qualifications", () => {
  const profile = getProfile({});
  assert.deepEqual(Array.from(profile.skills), []);
  assert.equal(profile.target, "");
});
