import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const stack = read("../src/components/layout/TabStack.jsx");
const nav = read("../src/lib/nav-items.js");
const dashboard = read("../src/pages/Dashboard.jsx");
const landing = read("../src/pages/Landing.jsx");
const schedule = read("../src/pages/Schedule.jsx");
const routePlanner = read("../src/pages/RoutePlanner.jsx");
const smartSchedule = read("../src/lib/smartSchedule.js");
const returnTo = read("../src/lib/returnTo.js");

test("canonical /jobs route renders seeker search and legacy career URL redirects", () => {
  assert.match(stack, /"\/jobs": JobSearchCommandCenter/);
  assert.match(stack, /"\/career\/search": "\/jobs"/);
  assert.match(stack, /"\/work\/jobs": WorkOrders/);
});

test("navigation separates seeker jobs from operational work orders", () => {
  assert.match(nav, /label: "Job Search", path: "\/jobs", group: "career"/);
  assert.match(nav, /label: "Work Orders", path: "\/work\/jobs", group: "work_tools"/);
  assert.doesNotMatch(nav, /label: "Work Orders", path: "\/jobs"/);
  assert.match(nav, /label: "Jobs", path: "\/jobs"/);
  assert.match(nav, /if \(path\.startsWith\("\/work\/jobs"\)\) return \{ label: "Work Orders", path: "\/work\/jobs" \}/);
});

test("career entry points use canonical seeker job search", () => {
  assert.match(dashboard, /path: "\/jobs"/);
  assert.match(dashboard, /navigate\("\/jobs"\)/);
  assert.doesNotMatch(dashboard, /path: "\/career\/search"/);
  assert.match(landing, /to="\/jobs">Find jobs/);
  assert.match(landing, /isAuthenticated \? "\/jobs" : "\/register"/);
});

test("operational surfaces never deep-link into seeker /jobs", () => {
  for (const source of [schedule, routePlanner, smartSchedule]) {
    assert.match(source, /\/work\/jobs/);
    assert.doesNotMatch(source, /["'`]\/jobs(?:\?|["'`])/);
  }
});

test("authentication defaults to Career Home instead of Driver Hub", () => {
  assert.match(returnTo, /consumeReturnTo\(fallback = "\/"\)/);
  assert.match(returnTo, /peekReturnTo\(\) \|\|\s*"\/"/);
  assert.doesNotMatch(returnTo, /fallback = "\/driver"/);
  assert.doesNotMatch(returnTo, /peekReturnTo\(\) \|\|\s*"\/driver"/);
});
