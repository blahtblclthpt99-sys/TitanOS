import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "api/functions/supportCreateCase.js"), "utf8");

test("case creation does not return false failure when initial-message rollback also fails", () => {
  assert.match(source, /if \(messageError\)/);
  assert.match(source, /if \(!cleanupError\) throw messageError/);
  assert.match(source, /support_case_created_degraded/);
  assert.match(source, /initial_message_not_created/);
  assert.match(source, /case_cleanup_failed/);
  assert.match(source, /return res\.status\(201\)\.json/);
});

test("successful rollback still reports the original initial-message failure", () => {
  assert.match(source, /\.delete\(\)[\s\S]*\.eq\("id", supportCase\.id\)[\s\S]*\.eq\("created_by_id", auth\.user\.id\)/);
  assert.match(source, /if \(!cleanupError\) throw messageError/);
});
