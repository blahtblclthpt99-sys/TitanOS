import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const legacy = readFileSync(new URL("../supabase/migrations/002_platform_expansion.sql", import.meta.url), "utf8");

test("original hire application read policy is unsafe and requires replacement", () => {
  const unsafe = /CREATE POLICY\s+hire_apps_read\s+ON\s+public\.hire_applications\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(true\)/i;
  assert.match(legacy, unsafe, "Audit original migration again if changed; never deploy unrestricted application reads.");
});
test("original schema has relevant job and application structures", () => {
  assert.match(legacy, /CREATE TABLE IF NOT EXISTS public\.hire_jobs/);
  assert.match(legacy, /CREATE TABLE IF NOT EXISTS public\.hire_applications/);
});
