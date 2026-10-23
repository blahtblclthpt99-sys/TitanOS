import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/api/functions.js", import.meta.url), "utf8");

test("Capacitor native app does not use the local WebView as a cloud API endpoint", () => {
  assert.match(source, /import\s*\{\s*Capacitor\s*\}\s*from\s*["']@capacitor\/core["']/);
  assert.match(source, /if\s*\(typeof window !== "undefined" && !Capacitor\.isNativePlatform\(\)\)/);
  assert.match(source, /if\s*\(base\) urls\.push\(\x60\$\{base\}\$\{path\}\x60\)/);
});

test("existing authenticated request and refresh flow are preserved", () => {
  assert.match(source, /getAccessToken\(\{ forceRefresh: true \}\)/);
  assert.match(source, /if \(isClientRejection\(lastError\)\)/);
});
