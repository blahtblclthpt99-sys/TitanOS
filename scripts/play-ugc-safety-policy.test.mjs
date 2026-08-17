import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260817_play_ugc_safety.sql");
const ugcApi = read("src/lib/ugcSafetyApi.js");
const menu = read("src/components/shared/ReportBlockMenu.jsx");
const trustPage = read("src/pages/TrustSafety.jsx");
const moderation = read("src/pages/AdminModeration.jsx");
const android = read("android/app/build.gradle");

const normalized = (value) => value.toLowerCase().replace(/\s+/g, " ");

test("UGC reports are persisted to a server moderation queue", () => {
  assert.match(ugcApi, /from\("trust_reports"\)/);
  assert.match(ugcApi, /\.insert\(/);
  assert.match(moderation, /listTrustReports/);
  assert.match(moderation, /resolveTrustReport/);
  assert.doesNotMatch(menu, /@\/lib\/trustSafetyApi/);
  assert.match(menu, /@\/lib\/ugcSafetyApi/);
});

test("user blocks are server-persistent and owner-scoped by RLS", () => {
  assert.match(ugcApi, /from\("user_blocks"\)/);
  assert.match(ugcApi, /\.upsert\(/);
  assert.match(ugcApi, /\.delete\(\)/);
  const sql = normalized(migration);
  assert.ok(sql.includes("alter table public.user_blocks enable row level security"));
  assert.ok(sql.includes("blocker_id = auth.uid()"));
  assert.ok(sql.includes("constraint user_blocks_pair_unique unique (blocker_id, blocked_id)"));
});

test("direct messages are rejected when either account blocks the other", () => {
  const sql = normalized(migration);
  assert.ok(sql.includes("create trigger trg_marketplace_messages_block"));
  assert.ok(sql.includes("before insert on public.marketplace_messages"));
  assert.ok(sql.includes("b.blocker_id::text = new.sender_id and b.blocked_id::text = new.recipient_id"));
  assert.ok(sql.includes("b.blocker_id::text = new.recipient_id and b.blocked_id::text = new.sender_id"));
});

test("standalone Trust & Safety uses durable report/block implementation", () => {
  assert.match(trustPage, /@\/lib\/ugcSafetyApi/);
  assert.match(trustPage, /await listBlockedUsers/);
  assert.match(trustPage, /await submitUserReport/);
  assert.match(trustPage, /await blockUser/);
});

test("release is unambiguously newer than code 35", () => {
  assert.match(android, /versionCode 36/);
  assert.match(android, /versionName "2\.0\.3"/);
});
