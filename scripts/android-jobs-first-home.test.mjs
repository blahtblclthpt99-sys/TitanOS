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

const normalizer = read("../src/lib/PathNormalizer.jsx");
test("Android cold start redirects restored driver route to jobs-first home", () => {
  assert.match(normalizer, /Capacitor\.isNativePlatform\(\)/);
  assert.match(normalizer, /path === "\/driver"/);
  assert.match(normalizer, /navigate\("\/", \{ replace: true \}\)/);
  assert.match(normalizer, /initialRouteChecked\.current = true/);
});

const entry = read("../src/main.jsx");
test("native WebView resets a restored Driver Hub hash before React mounts", () => {
  assert.match(entry, /Capacitor\.isNativePlatform\(\)/);
  assert.match(entry, /initialHash/);
  assert.match(entry, /window\.history\.replaceState/);
  assert.ok(entry.indexOf("window.history.replaceState") < entry.indexOf("ReactDOM.createRoot"));
});
