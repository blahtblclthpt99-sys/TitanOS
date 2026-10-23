import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const routes = read("src/components/layout/TabStack.jsx");
const nav = read("src/lib/nav-items.js");
const menu = read("src/pages/MoreMenu.jsx");
const support = read("src/pages/SupportCenter.jsx");
const app = read("src/App.jsx");

test("every published Support menu link resolves to a real jobs-first route", () => {
  assert.match(nav, /path: "\/support"/);
  assert.match(menu, /path:"\/support"/);
  assert.match(routes, /"\/support": SupportCenter/);
  assert.match(routes, /import\("@\/pages\/SupportCenter"\)/);
});

test("career support does not advertise retired Driver Hub", () => {
  assert.doesNotMatch(support, /Driver Hub|driver_hub|stopped recording mileage/i);
  assert.match(support, /Jobs & Applications/);
  assert.match(support, /Account & Login/);
});

test("existing public account deletion destination remains available", () => {
  assert.match(menu, /to="\/delete-account"/);
  assert.match(app, /<Route path="\/delete-account" element=\{<DeleteAccount \/>\}/);
});
