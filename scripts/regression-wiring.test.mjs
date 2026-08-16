/**
 * Regression pack entry — ensures critical new domains stay wired in npm test.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

describe("regression: test script wiring", () => {
  it("npm test includes export, search, settings, ai, gps, a11y, security, offline", () => {
    const t = pkg.scripts.test || "";
    for (const key of [
      "test:export",
      "test:search",
      "test:settings",
      "test:ai",
      "test:gps",
      "test:a11y",
      "test:security",
      "test:offline",
      "test:api",
      "test:comms",
      "test:observability",
      "test:code-quality",
      "test:scalability",
      "test:maintainability",
      "test:final-qa",
      "test:founding",
    ]) {
      assert.match(t, new RegExp(key.replace(":", "\\:")));
    }
  });

  it("node-test-setup bootstrap exists for aliases", () => {
    const setup = readFileSync(join(root, "scripts/node-test-setup.mjs"), "utf8");
    assert.match(setup, /register/);
    assert.match(setup, /localStorage/);
  });

  it("Android release follows material web bundle changes", () => {
    const workflow = readFileSync(join(root, ".github/workflows/android-release.yml"), "utf8");
    for (const path of ["src/**", "public/**", "index.html", "vite.config.*"]) {
      assert.ok(workflow.includes(path), `Android release trigger must include ${path}`);
    }
    assert.match(pkg.scripts["cap:sync"] || "", /npm run build/);
  });
});
