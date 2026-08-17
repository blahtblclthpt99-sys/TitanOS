import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const app = read("src/App.jsx");
const page = read("src/pages/DeleteAccount.jsx");
const more = read("src/pages/MoreMenu.jsx");
const privacy = read("src/pages/PrivacyPolicy.jsx");
const endpoint = read("api/functions/accountDeletionRequest.js");
const migration = read("supabase/migrations/20260817204500_account_deletion_requests.sql");

test("account deletion has a public web resource and in-app discovery path", () => {
  assert.match(app, /\/delete-account/);
  assert.match(app, /<DeleteAccount\s*\/>/);
  assert.match(more, /Delete account & data/);
  assert.match(more, /to="\/delete-account"/);
});

test("authenticated deletion requests are recorded server-side", () => {
  assert.match(page, /accountDeletionRequest/);
  assert.match(endpoint, /requireUser/);
  assert.match(endpoint, /account_deletion_requests/);
  assert.match(endpoint, /status:\s*"pending"/);
});

test("deletion ledger is server-owned and client roles are revoked", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.account_deletion_requests from anon, authenticated/i);
  assert.match(migration, /grant all on table public\.account_deletion_requests to service_role/i);
});

test("privacy policy has no internal legal-review placeholder and documents deletion", () => {
  assert.doesNotMatch(privacy, /Legal review:/i);
  assert.match(privacy, /Account Deletion & Data Retention/);
  assert.match(privacy, /\/delete-account/);
  assert.match(privacy, /Location Data/);
});
