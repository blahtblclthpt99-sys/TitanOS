import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

const CORE_TABLES = [
  "profiles",
  "customers",
  "jobs",
  "invoices",
  "estimates",
  "expenses",
  "employees",
  "companies",
  "company_members",
  "driver_profiles",
  "mileage_trips",
  "stripe_webhook_events",
  "fee_rules",
  "platform_launch",
  "support_cases",
  "titan_ai_knowledge",
];

function normalized(sql) {
  return sql.replace(/--.*$/gm, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").toLowerCase();
}

describe("TitanOS database destructive-migration guard", () => {
  it("has migrations to inspect", () => {
    assert.ok(files.length > 0, "No Supabase migrations found");
  });

  for (const file of files) {
    it(`${file} contains no Titan Attention takeover or broad purge`, () => {
      const sql = normalized(readFileSync(join(migrationsDir, file), "utf8"));

      assert.doesNotMatch(sql, /titan attention|attention_(?:profiles|campaigns|views|withdrawals|payment_events)/i);
      assert.doesNotMatch(sql, /purge[_\s-]*legacy[_\s-]*titanos/i);
      assert.doesNotMatch(sql, /purge[_\s-]*legacy[_\s-]*storage/i);

      // Reject the exact class of dynamic schema-erasure loop used on 2026-08-18.
      assert.doesNotMatch(
        sql,
        /for\s+\w+\s+in[\s\S]{0,1200}pg_tables[\s\S]{0,1200}execute\s+format\s*\(\s*['"]drop\s+table/i
      );
      assert.doesNotMatch(
        sql,
        /for\s+\w+\s+in[\s\S]{0,1200}pg_(?:views|matviews|proc)[\s\S]{0,1200}execute\s+format\s*\(\s*['"]drop\s+(?:view|materialized\s+view|function)/i
      );

      for (const table of CORE_TABLES) {
        const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const destructive = new RegExp(`\\bdrop\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?["']?${escaped}["']?\\b`, "i");
        assert.doesNotMatch(sql, destructive, `${file} attempts to drop protected TitanOS table ${table}`);
      }
    });
  }
});
