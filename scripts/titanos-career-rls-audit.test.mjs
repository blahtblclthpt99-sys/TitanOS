import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const legacy = readFileSync(new URL("../supabase/migrations/002_platform_expansion.sql", import.meta.url), "utf8");

// This is deliberately a migration review gate, not a runtime RLS test.
// The legacy file is not safe to deploy unchanged; developers must repair policy
// semantics in a reviewed replacement and test impersonated roles before release.
test("legacy hire application read policy is flagged as unsafe for production recovery", () => {
  const unsafe = /CREATE POLICY\s+hire_apps_read\s+ON\s+public\.hire_applications\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(true\)/i;
  assert.match(legacy, unsafe, "Update this audit if the original migration changes; never deploy unrestricted private application reads.");
});
test("original schema includes necessary job and application structures", () => {
  assert.match(legacy, /CREATE TABLE IF NOT EXISTS public\.hire_jobs/);
  assert.match(legacy, /CREATE TABLE IF NOT EXISTS public\.hire_applications/);
});
