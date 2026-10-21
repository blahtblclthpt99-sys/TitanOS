import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const matches = read("../src/pages/JobMatches.jsx");
const tracker = read("../src/pages/ApplicationTracker.jsx");
test("each job match can be sent to the application tracker", () => {
  assert.match(matches, /new URLSearchParams\(\{/);
  assert.match(matches, /to=\{\`\/applications\?\$\{trackerParams\.toString\(\)\}\`\}/);
  assert.match(matches, /Add to application tracker/);
});
test("tracker accepts job match prefill without submitting automatically", () => {
  assert.match(tracker, /useSearchParams\(\)/);
  assert.match(tracker, /searchParams\.get\("position"\)/);
  assert.match(tracker, /searchParams\.get\("company"\)/);
  assert.match(tracker, /setSearchParams\(\{\}, \{ replace: true \}\)/);
});
