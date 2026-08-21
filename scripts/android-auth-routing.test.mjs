import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authCallbackSource = readFileSync(
  new URL("../src/pages/AuthCallback.jsx", import.meta.url),
  "utf8"
);
const capacitorAuthSource = readFileSync(
  new URL("../src/lib/capacitor-auth.js", import.meta.url),
  "utf8"
);
const authSource = readFileSync(
  new URL("../src/api/auth.js", import.meta.url),
  "utf8"
);
const manifestSource = readFileSync(
  new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
  "utf8"
);

test("Android OAuth callback keeps HashRouter routing intact", () => {
  assert.match(authCallbackSource, /shouldUseHashRouter/);
  assert.match(authCallbackSource, /#\/auth\/callback/);
  assert.match(
    authCallbackSource,
    /if \(shouldUseHashRouter\(\)\)[\s\S]*replaceState\([\s\S]*#\/auth\/callback[\s\S]*return;[\s\S]*replaceState\([\s\S]*\/auth\/callback/
  );
});

test("Capacitor deep link maps the custom auth callback into the SPA hash route", () => {
  assert.match(capacitorAuthSource, /parsed\.host === "auth"/);
  assert.match(capacitorAuthSource, /parsed\.pathname\.startsWith\("\/callback"\)/);
  assert.match(capacitorAuthSource, /window\.location\.hash = `\/auth\/callback\$\{query\}`/);
});

test("Android registration is not hardwired to the disabled website host", () => {
  assert.doesNotMatch(authSource, /titanos-web\.vercel\.app/);
  assert.match(authSource, /function serverApiBases\(\)/);
  assert.match(authSource, /SERVER_UNAVAILABLE_STATUSES = new Set\(\[402, 404, 408, 502, 503, 504\]\)/);
  assert.match(authSource, /throw apiError\("Registration service unavailable", 503\)/);
  assert.match(authSource, /supabase\.auth\.signUp/);
});

test("Android registration bounds a dead API request before Supabase fallback", () => {
  assert.match(authSource, /SERVER_REGISTER_TIMEOUT_MS = 10_000/);
  assert.match(authSource, /new AbortController\(\)/);
  assert.match(authSource, /controller\.abort\(\)/);
  assert.match(authSource, /Registration service timed out/);
});

test("Android manifest accepts only the TitanOS auth callback custom scheme", () => {
  assert.match(manifestSource, /android:scheme="com\.titanos\.myapp"/);
  assert.match(manifestSource, /android:host="auth"/);
  assert.match(manifestSource, /android:pathPrefix="\/callback"/);
});
