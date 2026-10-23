import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const server = readFileSync(new URL("../api/functions/jobMatchesV2.js", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/lib/jobMatchProfileApi.js", import.meta.url), "utf8");
const screen = readFileSync(new URL("../src/pages/JobMatches.jsx", import.meta.url), "utf8");

test("jobs-first matching no longer queries Driver Hub profiles", () => {
  assert.doesNotMatch(server, /from\(["']driver_profiles["']\)/);
  assert.doesNotMatch(client, /from\(["']driver_profiles["']\)/);
  assert.doesNotMatch(screen, /getMyDriverProfile|saveMyDriverProfile/);
});

test("jobs-first server matches remain authenticated and tied to a real user", () => {
  assert.match(server, /admin\.auth\.getUser\(token\)/);
  assert.match(server, /const userId = userData\.user\.id/);
  assert.match(server, /admin\.from\(["']hire_jobs["']\)/);
  assert.match(server, /skills: \[\]/);
  assert.match(server, /certifications: \[\]/);
});

test("job preferences do not require Driver Hub enrollment", () => {
  assert.doesNotMatch(client, /Create your Driver Profile/);
  assert.match(client, /from\(["']job_match_preferences["']\)/);
});
