import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = "supabase/migrations/20260910124000_marketplace_message_update_integrity.sql";
const sql = readFileSync(join(root, migrationPath), "utf8");

describe("marketplace message update integrity", () => {
  it("classifies browser authority from OLD row identity, never caller-controlled NEW sender identity", () => {
    assert.match(sql, /OLD\.sender_id\s*=\s*actor_text/);
    assert.match(sql, /OLD\.created_by_id\s*=\s*actor_id/);
    assert.match(sql, /OLD\.recipient_id\s*=\s*actor_text/);
    assert.doesNotMatch(sql, /IF[\s\S]{0,220}NEW\.sender_id\s+(?:IS\s+DISTINCT\s+FROM|=)\s*(?:auth\.uid\(\)::text|actor_text)/i);
  });

  it("makes message identity and routing immutable to ordinary browser clients", () => {
    for (const column of [
      "id",
      "created_at",
      "created_by_id",
      "listing_id",
      "hire_job_id",
      "thread_id",
      "sender_id",
      "recipient_id",
    ]) {
      assert.match(
        sql,
        new RegExp(`NEW\\.${column}\\s*:=\\s*OLD\\.${column}`, "i"),
        `expected ${column} to be restored from OLD`
      );
    }
  });

  it("keeps read state recipient-owned and message body sender-owned", () => {
    assert.match(sql, /NEW\.read_at\s*:=\s*OLD\.read_at/);
    assert.match(sql, /IF\s+OLD\.recipient_id\s*=\s*actor_text\s+THEN[\s\S]*?NEW\.body\s*:=\s*OLD\.body/i);
  });

  it("fails closed for unaffiliated actors and preserves the direct-execution ACL boundary", () => {
    assert.match(sql, /RAISE\s+EXCEPTION\s+'Message update not authorized'/i);
    assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.protect_message_body\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i);
    assert.match(sql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.protect_message_body\(\)\s+TO\s+service_role/i);
  });
});
