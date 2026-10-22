import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const routes = read("../src/components/layout/TabStack.jsx");
const hub = read("../src/pages/CareerHub.jsx");
const resume = read("../src/pages/ResumeStudio.jsx");
const tracker = read("../src/pages/ApplicationTracker.jsx");
test("both core career tools have actual routes and home links", () => {
  for (const [path, name] of [["/resume", "ResumeStudio"], ["/applications", "ApplicationTracker"]]) {
    assert.ok(routes.includes(`"${path}": ${name}`));
    assert.ok(hub.includes(`to: "${path}"`));
  }
});
test("resume saves a local draft and offers export", () => {
  assert.match(resume, /localStorage\.setItem\(key/);
  assert.match(resume, /text\/plain/);
  assert.match(resume, /window\.print\(\)/);
});
test("application tracker records and updates stage locally", () => {
  assert.match(tracker, /localStorage\.setItem\(key/);
  assert.match(tracker, /setItems\(all=>all\.map/);
  assert.match(tracker, /do not submit applications/);
});

test("multiple-opening matching is opt-in and invitation does not claim verified vacancies", () => {
  assert.ok(hub.includes("titanos-multiple-openings-opt-in-v1"));
  assert.ok(hub.includes("Live alerts are not connected yet"));
  assert.ok(tracker.includes("Copy job invitation"));
  assert.ok(tracker.includes("Additional openings are not verified"));
});
