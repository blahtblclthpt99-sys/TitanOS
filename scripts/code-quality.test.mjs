/**
 * Code quality regression — orphans stay deleted; shared utilities stay single-sourced.
 *
 * The production-source inventory intentionally reads every supported source file under
 * Titan's browser, API, shared, public-runtime, and Supabase trees. This keeps the gate
 * broad even when new features are added without registering them in a hand-maintained list.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeAppPath, isUuid } from "../shared/safePath.js";
import { formatCurrency, formatMoney } from "../src/lib/formatCurrency.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const SCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const SOURCE_EXTENSIONS = new Set([...SCRIPT_EXTENSIONS, ".css", ".html", ".sql"]);
const PRODUCTION_ROOTS = ["src", "api", "shared", "public", "supabase"];
const ROOT_SOURCE_FILES = [
  "vite.config.js",
  "eslint.config.js",
  "postcss.config.js",
  "capacitor.config.ts",
].filter((rel) => existsSync(join(root, rel)));

function productionSourceFiles() {
  const files = [];

  const visit = (absolutePath) => {
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
        if (["node_modules", "dist", "coverage", ".git"].includes(entry.name)) continue;
        visit(join(absolutePath, entry.name));
      }
      return;
    }

    if (SOURCE_EXTENSIONS.has(extname(absolutePath))) files.push(absolutePath);
  };

  for (const rel of PRODUCTION_ROOTS) {
    const absolutePath = join(root, rel);
    if (existsSync(absolutePath)) visit(absolutePath);
  }
  for (const rel of ROOT_SOURCE_FILES) files.push(join(root, rel));

  return [...new Set(files)].sort();
}

function criticalSourceViolations(file) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const source = readFileSync(file, "utf8");
  const violations = [];
  const scriptSource = SCRIPT_EXTENSIONS.has(extname(file));

  if (source.includes("\0")) violations.push(`${rel}: contains a NUL byte`);

  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const location = `${rel}:${index + 1}`;
    if (/^\s*(?:<{7}|={7}|>{7})(?:\s|$)/.test(line)) violations.push(`${location}: unresolved merge-conflict marker`);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line)) violations.push(`${location}: private key material is forbidden`);
    if (/(?:sk_live_|rk_live_|sk-proj-|github_pat_|ghp_)[A-Za-z0-9_-]{12,}/.test(line)) {
      violations.push(`${location}: credential-like token is forbidden in production source`);
    }
    if (!scriptSource) return;
    if (/\bdebugger\s*;/.test(line)) violations.push(`${location}: debugger statement`);
    if (/\beval\s*\(/.test(line)) violations.push(`${location}: eval() is forbidden in production source`);
    if (/\bnew\s+Function\s*\(/.test(line)) violations.push(`${location}: new Function() is forbidden in production source`);
    if (/^\s*\/\/[\s]*@ts-nocheck\b/.test(line)) violations.push(`${location}: @ts-nocheck disables type safety`);
  });

  return { violations, lines: lines.length };
}

describe("code quality: whole production source", () => {
  it("reads every production source line and rejects critical defects", () => {
    const files = productionSourceFiles();
    let lineCount = 0;
    const violations = [];

    for (const file of files) {
      const result = criticalSourceViolations(file);
      lineCount += result.lines;
      violations.push(...result.violations);
    }

    assert.ok(files.length >= 25, `production inventory unexpectedly small: ${files.length} files`);
    assert.ok(lineCount >= 1000, `production inventory unexpectedly small: ${lineCount} lines`);
    assert.deepEqual(
      violations,
      [],
      `Critical production-source defects found while scanning ${files.length} files / ${lineCount} lines:\n${violations.join("\n")}`,
    );
  });
});

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
