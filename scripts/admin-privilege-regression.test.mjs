import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const authSource = readFileSync(new URL("../api/_lib/auth.js", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260816_lock_profile_privileged_columns.sql", import.meta.url),
  "utf8"
);

describe("admin authorization boundary", () => {
  it("uses immutable auth app_metadata and does not trust profiles.role", () => {
    assert.match(authSource, /app_metadata\?\.role\s*===\s*["']admin["']/);
    assert.doesNotMatch(authSource, /from\(["']profiles["']\)[\s\S]*select\(["']role["']\)/);
  });
});

describe("profile privilege boundary", () => {
  it("revokes table-wide client UPDATE before granting bounded columns", () => {
    assert.match(migrationSource, /revoke\s+update\s+on\s+table\s+public\.profiles\s+from\s+authenticated/i);
    assert.match(migrationSource, /grant\s+update\s*\([\s\S]*\)\s+on\s+table\s+public\.profiles\s+to\s+authenticated/i);
  });

  it("never grants client updates to authorization or entitlement fields", () => {
    const grant = migrationSource.match(/grant\s+update\s*\(([\s\S]*?)\)\s+on\s+table\s+public\.profiles\s+to\s+authenticated/i)?.[1] || "";
    for (const forbidden of [
      "role",
      "is_pro",
      "lifetime_premium",
      "paying_subscriber",
      "plan_tier",
      "account_type",
      "verified_worker",
      "verification_notes",
      "founding_member",
      "founding_tier",
      "is_founding_titan",
      "marketplace_pack_unlocked",
    ]) {
      assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(grant), false, `${forbidden} must remain server-owned`);
    }
  });
});
