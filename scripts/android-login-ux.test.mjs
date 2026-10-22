import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/pages/Login.jsx", import.meta.url), "utf8");

test("login guards duplicate submissions and normalizes email", () => {
  assert.match(source, /if \(loading\) return;/);
  assert.match(source, /loginViaEmailPassword\(email\.trim\(\), password\)/);
});
test("offline failures include an actionable message", () => {
  assert.match(source, /navigator\.onLine === false/);
  assert.match(source, /Check your internet connection and try again/);
});
test("tablet email keyboard disables unwanted capitalization", () => {
  assert.match(source, /autoCapitalize="none"/);
  assert.match(source, /spellCheck=\{false\}/);
});

const routes = readFileSync(new URL("../src/lib/returnTo.js", import.meta.url), "utf8");
const oauth = readFileSync(new URL("../src/pages/AuthCallback.jsx", import.meta.url), "utf8");
test("successful sign-in defaults to the jobs-first home, not Driver Hub", () => {
  assert.ok(routes.includes('consumeReturnTo(fallback = "/")'));
  assert.ok(routes.includes('rememberedDestination === "/driver"'));
  assert.ok(routes.includes('storedPath === "/driver" && fallback === "/"'));
  assert.ok(oauth.includes('consumeReturnTo("/")'));
  assert.ok(!oauth.includes('consumeReturnTo("/driver")'));
});
