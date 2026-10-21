import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nav = readFileSync(new URL("../src/lib/nav-items.js", import.meta.url), "utf8");
const stack = readFileSync(new URL("../src/components/layout/TabStack.jsx", import.meta.url), "utf8");

test("mobile exposes just Home, Find Work, Profile, and More", () => {
  const section = nav.split("export const MOBILE_TAB_ITEMS = [")[1].split("];")[0];
  assert.equal((section.match(/path: "/g) || []).length, 3);
  for (const path of ["/", "/career", "/profile"]) assert.ok(section.includes(`path: "${path}"`));
  assert.ok(!section.includes('path: "/driver"'));
  assert.ok(!section.includes('path: "/comms"'));
});
test("job seeker, employer, and contractor workspaces exist", () => {
  for (const heading of ['title: "Find Work"', 'title: "Employer"', 'title: "Independent Contractor"']) assert.ok(nav.includes(heading));
});
test("business jobs and driver hub remain routed", () => {
  assert.match(stack, /"\/jobs": Jobs/);
  assert.match(stack, /"\/driver": DriverHubTab/);
});
