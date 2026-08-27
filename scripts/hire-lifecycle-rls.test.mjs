import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260827091500_hire_lifecycle_rls_lockdown.sql", import.meta.url),
  "utf8"
);

test("application lifecycle records cannot be deleted by applicants", () => {
  assert.match(migration, /drop policy if exists hire_apps_delete on public\.hire_applications/i);
  assert.match(migration, /create policy hire_apps_delete_admin on public\.hire_applications[\s\S]*for delete to authenticated[\s\S]*using \(public\.is_admin\(\)\)/i);
});

test("saved job broad FOR ALL policy is removed", () => {
  assert.match(migration, /drop policy if exists hire_saves_own on public\.hire_saves/i);
  assert.doesNotMatch(migration, /create policy\s+\w+\s+on public\.hire_saves\s+for all/i);
});

test("saved jobs are private to the authenticated owner", () => {
  assert.match(migration, /create policy hire_saves_select on public\.hire_saves[\s\S]*created_by_id = auth\.uid\(\)[\s\S]*user_id = auth\.uid\(\)::text/i);
  assert.match(migration, /create policy hire_saves_insert on public\.hire_saves[\s\S]*created_by_id = auth\.uid\(\)[\s\S]*user_id = auth\.uid\(\)::text/i);
  assert.match(migration, /create policy hire_saves_delete on public\.hire_saves[\s\S]*created_by_id = auth\.uid\(\)[\s\S]*user_id = auth\.uid\(\)::text/i);
});

test("saved job identity is intentionally immutable through RLS", () => {
  assert.doesNotMatch(migration, /create policy\s+\w+\s+on public\.hire_saves\s+for update/i);
});
