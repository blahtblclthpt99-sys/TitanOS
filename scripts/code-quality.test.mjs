/**
 * Code quality regression — orphans stay deleted; shared utilities stay single-sourced.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeAppPath, isUuid } from "../shared/safePath.js";
import { formatCurrency, formatMoney } from "../src/lib/formatCurrency.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

describe("code quality: dead code removed", () => {
  it("orphaned modules stay deleted", () => {
    for (const rel of [
      "src/components/layout/QuickCreateFAB.jsx",
      "src/components/shared/FloatingVoiceButton.jsx",
      "src/lib/localDeals.js",
      "src/lib/app-params.js",
      "src/lib/app-origin.js",
      "src/components/ui/sidebar.jsx",
    ]) {
      assert.equal(existsSync(join(root, rel)), false, rel);
    }
  });
});

describe("code quality: shared utilities", () => {
  it("safePath is single-sourced via shared/", () => {
    assert.match(read("src/lib/safePath.js"), /@shared\/safePath/);
    assert.match(read("api/_lib/safePath.js"), /shared\/safePath/);
    assert.equal(sanitizeAppPath("/jobs"), "/jobs");
    assert.equal(sanitizeAppPath("https://evil.test"), "");
    assert.ok(isUuid("550e8400-e29b-41d4-a716-446655440000"));
  });

  it("driver excel reuses shared SpreadsheetML builder", () => {
    const src = read("src/lib/driverActivity/excelExport.js");
    assert.match(src, /@\/lib\/export\/excel/);
    assert.doesNotMatch(src, /function xmlEscape/);
  });

  it("formatMoney is cents-accurate and re-exported from platformFee", () => {
    assert.equal(formatMoney(12.5), formatCurrency(12.5, { cents: true }));
    assert.match(formatMoney(12.5), /12\.50|\$12\.50/);
    assert.match(read("src/lib/platformFee.js"), /export \{ formatMoney \}/);
  });

  it("session event imports from driverOs (not KeepAlive)", () => {
    for (const rel of [
      "src/components/driver/os/MissionControl.jsx",
      "src/components/driver/DriverShiftPanel.jsx",
      "src/components/layout/MobileActionDock.jsx",
    ]) {
      const src = read(rel);
      assert.match(src, /@\/lib\/driverOs/);
      assert.doesNotMatch(src, /DriverSessionKeepAlive/);
    }
  });

  it("editorconfig + code-quality rule exist", () => {
    assert.ok(existsSync(join(root, ".editorconfig")));
    assert.ok(existsSync(join(root, ".cursor/rules/code-quality.mdc")));
  });
});
