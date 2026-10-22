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

test("return-to destination actually resolves correctly after sign-in", async () => {
  const moduleCode = routes.replace(
    'import { normalizeAppPath } from "@/lib/routing";',
    'const normalizeAppPath = (path = "/") => path;'
  );
  const authRoutes = await import("data:text/javascript;base64," + Buffer.from(moduleCode).toString("base64"));
  const originalStorage = globalThis.sessionStorage;
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  try {
    assert.equal(authRoutes.resolveReturnTo({ pathname: "/login" }), "/");
    storage.set("titanos_auth_return_to", "/driver");
    assert.equal(authRoutes.resolveReturnTo({ pathname: "/login" }), "/");
    assert.equal(storage.has("titanos_auth_return_to"), false);
    storage.set("titanos_auth_return_to", "/driver");
    assert.equal(authRoutes.consumeReturnTo("/"), "/");
    assert.equal(
      authRoutes.resolveReturnTo({ state: { from: { pathname: "/driver" } } }),
      "/driver"
    );
    assert.equal(authRoutes.consumeReturnTo("/driver"), "/driver");
  } finally {
    if (originalStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalStorage;
  }
});
