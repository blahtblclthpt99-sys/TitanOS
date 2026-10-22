import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const routes = read("../src/components/layout/TabStack.jsx");
const nav = read("../src/lib/nav-items.js");
const careers = read("../src/pages/CareerHub.jsx");

test("careers is a real routed mobile tab", () => {
  assert.match(routes, /"\/career": CareerHub/);
  assert.match(routes, /import\("@\/pages\/CareerHub"\)/);
  assert.match(nav, /label: "Find Work", path: "\/career"/);
});
test("business jobs remain reachable rather than removed", () => {
  assert.match(routes, /"\/jobs": Jobs/);
  assert.match(careers, /to="\/more"/);
});
test("career actions point to existing job matching and profile routes", () => {
  for (const route of ["/hire/matches", "/hire", "/profile", "/assistant"]) {
    assert.ok(careers.includes(`to: "${route}"`), `Missing action ${route}`);
  }
});
