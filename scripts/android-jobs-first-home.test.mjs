import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const routes = read("../src/components/layout/TabStack.jsx");
const more = read("../src/pages/MoreMenu.jsx");
const home = read("../src/pages/CareerHub.jsx");
test("native authenticated home uses the career hub", () => {
  assert.match(routes, /"\/": CareerHub/);
  assert.match(home, /Find work\. Build your future\./);
});
test("original business dashboard is preserved behind an explicit route", () => {
  assert.match(routes, /"\/business-dashboard": Dashboard/);
  assert.match(more, /to="\/business-dashboard"/);
});
