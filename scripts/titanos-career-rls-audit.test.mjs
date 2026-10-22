import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const legacy = readFileSync(new URL("../supabase/migrations/002_platform_expansion.sql", import.meta.url), "utf8");

test("hire application read policy never permits every authenticated user", () => {
  const unsafe = /CREATE POLICY\s+hire_apps_read\s+ON\s+public\.hire_applications\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(true\)/i;
  assert.doesNotMatch(legacy, unsafe, "Block release: application messages must not be readable by all authenticated users.");
  assert.ok(legacy.includes("job.created_by_id = auth.uid()"));
  assert.ok(legacy.includes("job.id::text = hire_applications.hire_job_id"));
});
test("original schema has relevant job and application structures", () => {
  assert.match(legacy, /CREATE TABLE IF NOT EXISTS public\.hire_jobs/);
  assert.match(legacy, /CREATE TABLE IF NOT EXISTS public\.hire_applications/);
});

const repair = readFileSync(new URL("../supabase/migrations/20261021210000_restrict_legacy_hire_application_reads.sql", import.meta.url), "utf8");
test("hiring SQL blocks have valid delimiters", () => {
  assert.doesNotMatch(legacy, /END \$;/);
  assert.doesNotMatch(legacy, /DO \$ BEGIN/);
});
test("forward migration replaces old read policy and scopes employer access", () => {
  assert.match(repair, /DROP POLICY IF EXISTS hire_apps_read/);
  assert.match(repair, /job\.created_by_id = auth\.uid\(\)/);
  assert.match(repair, /job\.id::text = hire_applications\.hire_job_id/);
});
