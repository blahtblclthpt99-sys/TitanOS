import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/ErrorBoundary.jsx", import.meta.url), "utf8");

test("native error home action navigates through HashRouter", () => {
  assert.match(source, /Capacitor\.isNativePlatform\(\)/);
  assert.match(source, /window\.location\.hash\s*=\s*["']#\/["']/);
});

test("native packaged asset failures do not trigger web chunk reload loop", () => {
  assert.match(source, /isChunkLoadError\(error\)[^\n]*!Capacitor\.isNativePlatform\(\)/);
});

test("web errors still navigate home without changing Android package routes", () => {
  assert.match(source, /window\.location\.assign\(["']\/["']\)/);
});
