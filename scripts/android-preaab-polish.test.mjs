import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../src/pages/CareerHub.jsx");
const more = read("../src/pages/MoreMenu.jsx");
const brand = read("../src/components/brand/TitanWordmark.jsx");

test("career home reflects free job-seeker focus without inventing job availability", () => {
  assert.ok(home.includes("one free workspace"));
  assert.ok(home.includes("when the live jobs service is connected"));
  assert.ok(home.includes('to="/more"'));
});
test("More menu avoids duplicate matching CTA and keeps deletion below tool groups", () => {
  assert.ok(!more.includes('to="/hire/matches"'));
  assert.ok(more.indexOf('className="space-y-8"') < more.indexOf('to="/delete-account"'));
});
test("brand tagline matches approved employment focus", () => {
  assert.ok(brand.includes("Work Builds Tomorrow"));
  assert.ok(!brand.includes("Platform for Modern Business"));
});
