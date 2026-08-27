import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "./hire-native-integrity.test.mjs";
import "./hire-lifecycle-rls.test.mjs";

const migrationPath = new URL("../supabase/migrations/20260827084500_enforce_career_pipeline_transitions.sql", import.meta.url);
const sql = await readFile(migrationPath, "utf8");

test("career pipeline migration installs a state-update trigger", () => {
  assert.match(sql, /create\s+trigger\s+enforce_career_pipeline_transition/i);
  assert.match(sql, /before\s+update\s+of\s+state\s+on\s+public\.job_match_interactions/i);
  assert.match(sql, /execute\s+function\s+public\.enforce_career_pipeline_transition\(\)/i);
});

test("database guard preserves idempotent updates and monotonic stages", () => {
  assert.match(sql, /if\s+new\.state\s*=\s*old\.state\s+then/i);
  assert.match(sql, /new_rank\s*<=\s*old_rank/i);
  assert.match(sql, /array\['saved','applied','screening','interview','offer','hired','closed'\]/i);
});

test("database guard constrains ignored state restoration", () => {
  assert.match(sql, /if\s+old\.state\s*=\s*'ignored'\s+then/i);
  assert.match(sql, /new\.state\s+in\s*\('saved',\s*'applied'\)/i);
  assert.match(sql, /if\s+new\.state\s*=\s*'ignored'\s+then/i);
  assert.match(sql, /old\.state\s*=\s*'saved'/i);
});

test("database guard raises a constraint-style error on invalid transitions", () => {
  assert.match(sql, /errcode\s*=\s*'23514'/i);
  assert.match(sql, /invalid career pipeline transition/i);
});
