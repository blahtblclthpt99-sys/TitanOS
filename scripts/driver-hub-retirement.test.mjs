import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync(new URL("../src/components/layout/TabStack.jsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("../src/lib/nav-items.js", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../src/components/layout/MobileNav.jsx", import.meta.url), "utf8");

test("Driver Hub is absent from the jobs-first navigation configuration", () => {
  assert.doesNotMatch(nav, /Driver Hub|\/driver-hub/);
  assert.doesNotMatch(mobile, /DriverHub|Driver Hub/);
});
test("legacy Driver Hub paths redirect to job search", () => {
  assert.match(route, /path === "\/driver"/);
  assert.match(route, /path\.startsWith\("\/driver\/"\)/);
  assert.match(route, /path === "\/driver-hub"/);
  assert.match(route, /to="\/hire" replace/);
});
test("job seeking and résumé routes remain available", () => {
  assert.match(route, /"\/hire": Hire/);
  assert.match(route, /"\/hire\/matches": JobMatches/);
  assert.match(route, /"\/resume": ResumeBuilder/);
});
