import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260827090000_hire_application_save_integrity.sql", import.meta.url),
  "utf8"
);

test("native applications require an existing open unexpired TitanOS job", () => {
  assert.match(migration, /from public\.hire_jobs[\s\S]*where id::text = new\.hire_job_id/i);
  assert.match(migration, /job\.status <> 'open'/i);
  assert.match(migration, /job\.deadline is not null and job\.deadline < current_date/i);
  assert.match(migration, /Native job does not exist/i);
});

test("native applications reject self-application and duplicate concurrent writes", () => {
  assert.match(migration, /Job owners cannot apply to their own job/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('hire_application:'/i);
  assert.match(migration, /An application for this job already exists/i);
});

test("applicant identity is immutable and applicant cannot forge employer decisions", () => {
  assert.match(migration, /Application identity fields are immutable/i);
  assert.match(migration, /Applicants cannot choose an employer decision status/i);
  assert.match(migration, /Applicants may only withdraw a pending application/i);
  assert.match(migration, /old\.status = 'pending' and new\.status in \('accepted', 'rejected'\)/i);
});

test("native saves require a TitanOS job and serialize duplicate creation", () => {
  assert.match(migration, /A save must always reference a native TitanOS job/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('hire_save:'/i);
  assert.match(migration, /This job is already saved/i);
});

test("integrity trigger functions are not directly executable by app roles", () => {
  assert.match(migration, /revoke all on function public\.enforce_hire_application_integrity\(\) from authenticated/i);
  assert.match(migration, /revoke all on function public\.enforce_hire_save_integrity\(\) from authenticated/i);
  assert.match(migration, /before insert or update on public\.hire_applications/i);
  assert.match(migration, /before insert on public\.hire_saves/i);
});
